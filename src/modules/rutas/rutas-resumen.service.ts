import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { calcularComision, calcularVentanaPeriodo } from "../../domain/liquidacion";
import { aplicarVisibilidad, ClienteResumen, ResumenRuta, ResumenRutaVisible } from "../../domain/resumen-ruta";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { Caja } from "./caja.entity";
import { Liquidacion } from "./liquidacion.entity";
import { LiquidacionesService } from "./liquidaciones.service";

export interface RequesterResumenContext {
  rol: RolUsuario;
  sub: number;
}

@Injectable()
export class RutasResumenService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaConfig)
    private readonly configRepo: Repository<RutaConfig>,
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,
    private readonly liquidacionesService: LiquidacionesService,
  ) {}

  async obtener(
    rutaId: number,
    requester: RequesterResumenContext,
  ): Promise<ResumenRutaVisible> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const config = await this.configRepo.findOne({ where: { ruta: { id: rutaId } } });
    const periodo = config?.periodoLiquidacion ?? "diario";
    const { inicio, fin } = calcularVentanaPeriodo(periodo, new Date());

    const caja = await this.cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    const ultima = await this.liquidacionRepo.findOne({
      where: { ruta: { id: rutaId } },
      order: { fecha: "DESC" },
    });

    const totales = await this.liquidacionesService.calcularTotales(rutaId, inicio, fin);
    const prestamosActivos = await this.contarPrestamosActivos(rutaId);
    const clientes = await this.listarClientes(rutaId);

    const comisionPorcentaje = config?.comisionActiva ? config.comisionPorcentaje : 0;
    const comisionValor = calcularComision(
      totales.totalCobradoPeriodo,
      config?.comisionActiva ?? false,
      config?.comisionPorcentaje ?? 0,
    );

    const resumen: ResumenRuta = {
      rutaId,
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

  private async contarPrestamosActivos(rutaId: number): Promise<{ cantidad: number; valorTotal: number }> {
    const row = await this.liquidacionRepo.manager
      .createQueryBuilder()
      .select("COUNT(pr.id)::int", "cantidad")
      .addSelect("COALESCE(SUM(pr.valor), 0)", "valorTotal")
      .from("prestamos", "pr")
      .where("pr.ruta_id = :rutaId", { rutaId })
      .andWhere("pr.estatus = :vigente", { vigente: "vigente" })
      .getRawOne<{ cantidad: string; valorTotal: string }>();
    return {
      cantidad: Number(row?.cantidad ?? 0),
      valorTotal: Number(row?.valorTotal ?? 0),
    };
  }

  private async listarClientes(rutaId: number): Promise<ClienteResumen[]> {
    const filas = await this.liquidacionRepo.manager
      .createQueryBuilder()
      .select(["c.id", "c.nombre", "c.apellido", "c.negocio"])
      .from("clientes", "c")
      .where("c.ruta_id = :rutaId", { rutaId })
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