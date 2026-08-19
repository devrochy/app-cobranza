import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import {
  calcularComision,
  calcularVentanaPeriodo,
  PeriodoLiquidacion,
} from "../../domain/liquidacion";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { Caja } from "./caja.entity";
import { Liquidacion } from "./liquidacion.entity";

export interface GenerarLiquidacionInput {
  comentario?: string | null;
}

export interface RequesterLiquidacionContext {
  rol: RolUsuario;
  sub: number;
}

export interface LiquidacionPublic {
  id: number;
  rutaId: number;
  fecha: string;
  periodo: PeriodoLiquidacion;
  cajaAnterior: number;
  cajaActual: number;
  estimadoACobrar: number;
  totalInyeccion: number;
  totalCobradoPeriodo: number;
  totalCobradoDia: number;
  totalPrestado: number;
  totalGastos: number;
  sumaCartera: number;
  comisionPorcentaje: number;
  comisionValor: number;
  comentario: string | null;
  createdAt: Date;
}

@Injectable()
export class LiquidacionesService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaConfig)
    private readonly configRepo: Repository<RutaConfig>,
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,
    private readonly dataSource: DataSource,
  ) {}

  async generar(
    rutaId: number,
    input: GenerarLiquidacionInput,
    requester: RequesterLiquidacionContext,
  ): Promise<LiquidacionPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const config = await this.configRepo.findOne({ where: { ruta: { id: rutaId } } });
    const periodo = config?.periodoLiquidacion ?? "diario";

    const caja = await this.cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    if (!caja) {
      throw new NotFoundException("La caja de la ruta no existe");
    }

    const { inicio, fin } = calcularVentanaPeriodo(periodo, new Date());

    const saved = await this.dataSource.transaction(async (manager) => {
      const liquidacionRepo = manager.getRepository(Liquidacion);
      const cajaRepo = manager.getRepository(Caja);

      const ultima = await liquidacionRepo.findOne({
        where: { ruta: { id: rutaId } },
        order: { fecha: "DESC" },
      });
      if (ultima && this.estaEnVentana(ultima.fecha, inicio, fin)) {
        throw new ConflictException("Ya existe una liquidación para el periodo vigente");
      }

      const cajaActual = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
      const cajaAnterior = ultima?.cajaActual ?? caja.saldoInicial;

      const estimadoACobrar = await this.sumaCuotasPendientes(manager, rutaId, inicio, fin);
      const sumaAbonos = await this.sumaAbonos(manager, rutaId);
      const sumaCartera = Math.max(0, estimadoACobrar - sumaAbonos);
      const totalCobradoPeriodo = await this.sumaPagos(manager, rutaId, inicio, fin);
      const totalCobradoDia = await this.sumaPagos(manager, rutaId, this.inicioDelDia(fin), this.finDelDia(fin));
      const totalPrestado = await this.sumaPrestamos(manager, rutaId, inicio, fin);
      const totalGastos = await this.sumaGastosAprobados(manager, rutaId, inicio, fin);
      const totalInyeccion = await this.sumaInyeccionesActivas(manager, rutaId, inicio, fin);

      const comisionPorcentaje = config?.comisionActiva ? config.comisionPorcentaje : 0;
      const comisionValor = calcularComision(
        totalCobradoPeriodo,
        config?.comisionActiva ?? false,
        config?.comisionPorcentaje ?? 0,
      );

      const liquidacion = liquidacionRepo.create({
        ruta: { id: rutaId } as Ruta,
        rutaId,
        fecha: this.fechaLocal(new Date()),
        periodo,
        cajaAnterior,
        cajaActual: cajaActual?.saldoActual ?? caja.saldoActual,
        estimadoACobrar,
        totalInyeccion,
        totalCobradoPeriodo,
        totalCobradoDia,
        totalPrestado,
        totalGastos,
        sumaCartera,
        comisionPorcentaje,
        comisionValor,
        comentario: input.comentario ?? null,
      });
      return liquidacionRepo.save(liquidacion);
    });

    return this.toPublic(saved);
  }

  private estaEnVentana(fecha: string, inicio: Date, fin: Date): boolean {
    const d = new Date(`${fecha}T00:00:00`);
    d.setHours(0, 0, 0, 0);
    const ini = new Date(inicio);
    ini.setHours(0, 0, 0, 0);
    const finD = new Date(fin);
    finD.setHours(23, 59, 59, 999);
    return d >= ini && d <= finD;
  }

  private inicioDelDia(fin: Date): Date {
    const d = new Date(fin);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private finDelDia(fin: Date): Date {
    const d = new Date(fin);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private fechaLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private async sumaCuotasPendientes(
    manager: EntityManager,
    rutaId: number,
    inicio: Date,
    fin: Date,
  ): Promise<number> {
    const row = await manager
      .createQueryBuilder()
      .select("COALESCE(SUM(c.valor_esperado), 0)", "total")
      .from("cuotas", "c")
      .innerJoin("prestamos", "p", "p.id = c.prestamo_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("p.estatus = :vigente", { vigente: "vigente" })
      .andWhere("c.estatus IN (:...estatus)", { estatus: ["pendiente", "atrasada"] })
      .andWhere("c.fecha_vencimiento >= :inicio", { inicio })
      .andWhere("c.fecha_vencimiento <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaAbonos(manager: EntityManager, rutaId: number): Promise<number> {
    const row = await manager
      .createQueryBuilder()
      .select("COALESCE(SUM(a.valor), 0)", "total")
      .from("abonos", "a")
      .innerJoin("prestamos", "p", "p.id = a.prestamo_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("p.estatus = :vigente", { vigente: "vigente" })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaPagos(manager: EntityManager, rutaId: number, inicio: Date, fin: Date): Promise<number> {
    // Solo pagos de cuotas atribuibles a la ruta (vía cuota → préstamo).
    // Los pagos con cuota_id NULL (huérfanos tras HU-48) no se atribuyen aquí.
    const row = await manager
      .createQueryBuilder()
      .select("COALESCE(SUM(pa.valor), 0)", "total")
      .from("pagos", "pa")
      .innerJoin("cuotas", "c", "c.id = pa.cuota_id")
      .innerJoin("prestamos", "p", "p.id = c.prestamo_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("p.estatus = :vigente", { vigente: "vigente" })
      .andWhere("pa.fecha_hora >= :inicio", { inicio })
      .andWhere("pa.fecha_hora <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaPrestamos(manager: EntityManager, rutaId: number, inicio: Date, fin: Date): Promise<number> {
    const row = await manager
      .createQueryBuilder()
      .select("COALESCE(SUM(pr.valor), 0)", "total")
      .from("prestamos", "pr")
      .where("pr.ruta_id = :rutaId", { rutaId })
      .andWhere("pr.fecha_otorgado >= :inicio", { inicio })
      .andWhere("pr.fecha_otorgado <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaGastosAprobados(manager: EntityManager, rutaId: number, inicio: Date, fin: Date): Promise<number> {
    const row = await manager
      .createQueryBuilder()
      .select("COALESCE(SUM(g.valor), 0)", "total")
      .from("gastos", "g")
      .where("g.ruta_id = :rutaId", { rutaId })
      .andWhere("g.aprobado = true")
      .andWhere("g.estado = :activo", { activo: "activo" })
      .andWhere("g.fecha_hora >= :inicio", { inicio })
      .andWhere("g.fecha_hora <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaInyeccionesActivas(manager: EntityManager, rutaId: number, inicio: Date, fin: Date): Promise<number> {
    const row = await manager
      .createQueryBuilder()
      .select("COALESCE(SUM(i.valor), 0)", "total")
      .from("inyecciones", "i")
      .where("i.ruta_id = :rutaId", { rutaId })
      .andWhere("i.estado = :estado", { estado: "activa" })
      .andWhere("i.fecha_hora >= :inicio", { inicio })
      .andWhere("i.fecha_hora <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private toPublic(l: Liquidacion): LiquidacionPublic {
    return {
      id: l.id,
      rutaId: l.rutaId,
      fecha: l.fecha,
      periodo: l.periodo,
      cajaAnterior: l.cajaAnterior,
      cajaActual: l.cajaActual,
      estimadoACobrar: l.estimadoACobrar,
      totalInyeccion: l.totalInyeccion,
      totalCobradoPeriodo: l.totalCobradoPeriodo,
      totalCobradoDia: l.totalCobradoDia,
      totalPrestado: l.totalPrestado,
      totalGastos: l.totalGastos,
      sumaCartera: l.sumaCartera,
      comisionPorcentaje: l.comisionPorcentaje,
      comisionValor: l.comisionValor,
      comentario: l.comentario,
      createdAt: l.createdAt,
    };
  }
}