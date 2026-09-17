import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { calcularComision, calcularVentanaPeriodo } from "../../domain/liquidacion";
import { aplicarVisibilidad, ClienteResumen, ResumenCartera, ResumenCarteraVisible } from "../../domain/resumen-cartera";
import { Cartera } from "./cartera.entity";
import { CarteraConfig } from "./cartera-config.entity";
import { Caja } from "./caja.entity";
import { Liquidacion } from "./liquidacion.entity";
import { LiquidacionesService } from "./liquidaciones.service";

export interface RequesterResumenContext {
  rol: RolUsuario;
  sub: number;
}

@Injectable()
export class CarterasResumenService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(CarteraConfig)
    private readonly configRepo: Repository<CarteraConfig>,
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,
    private readonly liquidacionesService: LiquidacionesService,
  ) {}

  async obtener(
    carteraId: number,
    requester: RequesterResumenContext,
  ): Promise<ResumenCarteraVisible> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const config = await this.configRepo.findOne({ where: { cartera: { id: carteraId } } });
    const periodo = config?.periodoLiquidacion ?? "diario";
    const { inicio, fin } = calcularVentanaPeriodo(periodo, new Date());

    const caja = await this.cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    const ultima = await this.liquidacionRepo.findOne({
      where: { cartera: { id: carteraId } },
      order: { fecha: "DESC" },
    });

    const totales = await this.liquidacionesService.calcularTotales(carteraId, inicio, fin);
    const prestamosActivos = await this.contarPrestamosActivos(carteraId);
    const clientes = await this.listarClientes(carteraId);

    const comisionPorcentaje = config?.comisionActiva ? config.comisionPorcentaje : 0;
    const comisionValor = calcularComision(
      totales.totalCobradoPeriodo,
      config?.comisionActiva ?? false,
      config?.comisionPorcentaje ?? 0,
    );

    const resumen: ResumenCartera = {
      carteraId,
      cajaActual: caja?.saldoActual ?? 0,
      cajaAnterior: ultima?.cajaActual ?? caja?.saldoInicial ?? 0,
      fechaUltimaLiquidacion: ultima?.fecha ?? null,
      gastosPeriodo: totales.totalGastos,
      cobradoPeriodo: totales.totalCobradoPeriodo,
      prestadoPeriodo: totales.totalPrestado,
      inyeccionesPeriodo: totales.totalInyeccion,
      carteraVigente: totales.sumaCartera,
      prestamosActivos,
      comisionPorcentaje,
      comisionValor,
      clientes,
    };

    return aplicarVisibilidad(resumen, {
      mostrarCaja: config?.mostrarCaja ?? false,
      mostrarPrestamos: config?.mostrarPrestamos ?? false,
      ocultarCartera: config?.ocultarCartera ?? false,
      mostrarCobroEstimado: config?.mostrarCobroEstimado ?? false,
      mostrarFechaUltimaLiquidada: config?.mostrarFechaUltimaLiquidada ?? false,
    });
  }

  private async contarPrestamosActivos(carteraId: number): Promise<{ cantidad: number; valorTotal: number }> {
    const row = await this.liquidacionRepo.manager
      .createQueryBuilder()
      .select("COUNT(pr.id)::int", "cantidad")
      .addSelect("COALESCE(SUM(pr.valor), 0)", "valorTotal")
      .from("prestamos", "pr")
      .where("pr.cartera_id = :carteraId", { carteraId })
      .andWhere("pr.estatus = :vigente", { vigente: "vigente" })
      .getRawOne<{ cantidad: string; valorTotal: string }>();
    return {
      cantidad: Number(row?.cantidad ?? 0),
      valorTotal: Number(row?.valorTotal ?? 0),
    };
  }

  private async listarClientes(carteraId: number): Promise<ClienteResumen[]> {
    const filas = await this.liquidacionRepo.manager
      .createQueryBuilder()
      .select(["c.id", "c.nombre", "c.apellido", "c.negocio"])
      .from("clientes", "c")
      .where("c.cartera_id = :carteraId", { carteraId })
      .orderBy("c.nombre", "ASC")
      .getRawMany<{
        id: number;
        nombre: string;
        apellido: string;
        negocio: string | null;
      }>();
    return filas.map((f) => ({
      id: Number(f.id),
      nombre: `${f.nombre} ${f.apellido}`.trim(),
      negocio: f.negocio,
    }));
  }
}