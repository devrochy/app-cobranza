import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import {
  ClienteBreve,
  porcentajeCobrarSemanal,
  ventanaDiaLocal,
  ventanaSemanaLocal,
} from "../../domain/reporte-diario";
import { Ruta } from "./ruta.entity";
import { ReporteDiario } from "./reporte-diario.entity";
import { LiquidacionesService } from "./liquidaciones.service";
import { EstadisticasRutaService } from "./estadisticas-ruta.service";

export interface RequesterReportesContext {
  rol: RolUsuario;
  sub: number;
}

/** Campos del reporte diario que se persisten al generarlo. */
export interface ReporteDiarioCampos {
  cobradoDia: number;
  prestadoDia: number;
  clientesVisitadosJson: ClienteBreve[] | null;
  clientesSinPagoJson: ClienteBreve[] | null;
  horaInicio: string | null;
  horaFin: string | null;
}

/** KPIs del reporte del día (REQ-PANEL-008). */
export interface ReporteDiaPublic {
  rutaId: number;
  fecha: string;
  cobradoDia: number;
  prestadoDia: number;
  /** Cobrado del día (sin descontar gastos). */
  cajaDiaSinGastos: number;
  totalGastosDia: number;
  /** Cobrado del día menos gastos aprobados del día. */
  cajaDiaConGastos: number;
  horaPrimeraCuota: string | null;
  horaUltimaCuota: string | null;
  porcentajeCobrarSemanal: number;
  /** Clientes del día que pagaron, que faltan y el total de la lista. */
  pagaron: number;
  faltan: number;
  totalDia: number;
  /** Clientes del día sin cuota pendiente/atrasada (sin deuda viva). */
  clientesSinCuentas: number;
  clientesNotificados: ClienteBreve[];
  clientesNoVisitados: ClienteBreve[];
}

export interface ReporteDiarioHistorialPublic {
  id: number;
  rutaId: number;
  fecha: string;
  cobradoDia: number;
  prestadoDia: number;
  clientesVisitados: ClienteBreve[];
  clientesSinPago: ClienteBreve[];
  horaInicio: string | null;
  horaFin: string | null;
}

export interface ExportacionReportes {
  filename: string;
  buffer: Buffer;
}

interface VisitaDia {
  clienteId: number;
  nombre: string;
  resultado: "pago" | "no_pago";
}

/**
 * Reporte diario por ruta (HU-18/HU-50): agrega cobrado/prestado/gastos, horas de
 * cuota, % de cobro semanal y los listados de visitados/notificados/no visitados.
 */
@Injectable()
export class ReportesDiariosService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(ReporteDiario)
    private readonly reporteRepo: Repository<ReporteDiario>,
    private readonly liquidacionesService: LiquidacionesService,
    private readonly estadisticasRutaService: EstadisticasRutaService,
    private readonly dataSource: DataSource,
  ) {}

  /** Fecha local (YYYY-MM-DD) del servidor; usada cuando no se pasa `fecha`. */
  fechaDeHoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }

  /** Agregados que se guardan en `reportes_diarios` al generar el reporte. */
  async computarCampos(rutaId: number, fecha: string): Promise<ReporteDiarioCampos> {
    const { inicio, fin } = ventanaDiaLocal(fecha);
    const totales = await this.liquidacionesService.calcularTotales(rutaId, inicio, fin);
    const visitas = await this.visitasDelDia(rutaId, fecha);
    const { horaInicio, horaFin } = await this.horasDeCuotas(rutaId, inicio, fin);

    const visitados = this.unicos(visitas);
    const sinPago = this.unicos(visitas.filter((v) => v.resultado === "no_pago"));

    return {
      cobradoDia: totales.totalCobradoPeriodo,
      prestadoDia: totales.totalPrestado,
      clientesVisitadosJson: visitados,
      clientesSinPagoJson: sinPago,
      horaInicio,
      horaFin,
    };
  }

  /** KPIs del día: cobrado/gastos, horas de cuota, % semanal y listados. */
  async reporteDia(
    rutaId: number,
    fecha: string,
    requester: RequesterReportesContext,
  ): Promise<ReporteDiaPublic> {
    await this.validarRuta(rutaId, requester);

    const { inicio, fin } = ventanaDiaLocal(fecha);
    const semana = ventanaSemanaLocal(fecha);

    const [totalesDia, totalesSemana, visitas, delDia, horas, notificados] =
      await Promise.all([
        this.liquidacionesService.calcularTotales(rutaId, inicio, fin),
        this.liquidacionesService.calcularTotales(rutaId, semana.inicio, semana.fin),
        this.visitasDelDia(rutaId, fecha),
        this.estadisticasRutaService.clientesDelDia(rutaId, fecha),
        this.horasDeCuotas(rutaId, inicio, fin),
        this.clientesNotificados(rutaId, fecha),
      ]);

    const idsVisitados = new Set(visitas.map((v) => v.clienteId));
    // `pagaron` se deriva de los pagos (igual que `cobradoDia`); un cliente
    // puede pagar desde el panel sin que se registre una visita.
    const idsPagaron = await this.clientesQuePagaron(rutaId, inicio, fin);
    const idsAtendidos = new Set([...idsVisitados, ...idsPagaron]);
    const cobradoDia = totalesDia.totalCobradoPeriodo;
    const totalGastosDia = totalesDia.totalGastos;
    const sinCuentas = await this.contarSinDeudaViva(
      rutaId,
      delDia.map((c) => c.clienteId),
    );

    return {
      rutaId,
      fecha,
      cobradoDia,
      prestadoDia: totalesDia.totalPrestado,
      cajaDiaSinGastos: cobradoDia,
      totalGastosDia,
      cajaDiaConGastos: Math.round((cobradoDia - totalGastosDia) * 100) / 100,
      horaPrimeraCuota: horas.horaInicio,
      horaUltimaCuota: horas.horaFin,
      porcentajeCobrarSemanal: porcentajeCobrarSemanal(
        totalesSemana.totalCobradoPeriodo,
        totalesSemana.estimadoACobrar,
      ),
      pagaron: idsPagaron.size,
      faltan: delDia.filter((c) => !idsPagaron.has(c.clienteId)).length,
      totalDia: delDia.length,
      clientesSinCuentas: sinCuentas,
      clientesNotificados: notificados,
      clientesNoVisitados: delDia.filter((c) => !idsAtendidos.has(c.clienteId)),
    };
  }

  async historial(
    rutaId: number,
    desde: string | null,
    hasta: string | null,
    requester: RequesterReportesContext,
  ): Promise<ReporteDiarioHistorialPublic[]> {
    await this.validarRuta(rutaId, requester);

    const qb = this.reporteRepo
      .createQueryBuilder("r")
      .where("r.ruta_id = :rutaId", { rutaId })
      .orderBy("r.fecha", "DESC");
    if (desde) {
      qb.andWhere("r.fecha >= :desde", { desde });
    }
    if (hasta) {
      qb.andWhere("r.fecha <= :hasta", { hasta });
    }

    const reportes = await qb.getMany();
    return reportes.map((r) => this.toHistorialPublic(r));
  }

  async exportarHistorial(
    rutaId: number,
    desde: string | null,
    hasta: string | null,
    requester: RequesterReportesContext,
  ): Promise<ExportacionReportes> {
    const reportes = await this.historial(rutaId, desde, hasta, requester);

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet("Reportes diarios");
    hoja.columns = [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Cobrado del día", key: "cobradoDia", width: 16 },
      { header: "Prestado del día", key: "prestadoDia", width: 16 },
      { header: "Hora primera cuota", key: "horaInicio", width: 18 },
      { header: "Hora última cuota", key: "horaFin", width: 18 },
      { header: "Clientes visitados", key: "visitados", width: 60 },
      { header: "Clientes sin pago", key: "sinPago", width: 60 },
    ];
    for (const reporte of reportes) {
      hoja.addRow({
        fecha: reporte.fecha,
        cobradoDia: reporte.cobradoDia,
        prestadoDia: reporte.prestadoDia,
        horaInicio: reporte.horaInicio ?? "",
        horaFin: reporte.horaFin ?? "",
        visitados: reporte.clientesVisitados.map((c) => c.nombre).join(", "),
        sinPago: reporte.clientesSinPago.map((c) => c.nombre).join(", "),
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const sufijo = desde || hasta ? `-${desde ?? "inicio"}_${hasta ?? "hoy"}` : "";
    return { filename: `reportes-diarios-ruta-${rutaId}${sufijo}.xlsx`, buffer };
  }

  private async validarRuta(
    rutaId: number,
    requester: RequesterReportesContext,
  ): Promise<Ruta> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    return ruta;
  }

  private async clientesQuePagaron(
    rutaId: number,
    inicio: Date,
    fin: Date,
  ): Promise<Set<number>> {
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("DISTINCT pa.cliente_id", "clienteId")
      .from("pagos", "pa")
      .innerJoin("cuotas", "c", "c.id = pa.cuota_id")
      .innerJoin("prestamos", "p", "p.id = c.prestamo_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("p.estatus = :vigente", { vigente: "vigente" })
      .andWhere("pa.fecha_hora >= :inicio", { inicio })
      .andWhere("pa.fecha_hora <= :fin", { fin })
      .getRawMany<{ clienteId: string }>();
    return new Set(filas.map((f) => Number(f.clienteId)));
  }

  private async visitasDelDia(rutaId: number, fecha: string): Promise<VisitaDia[]> {
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("v.cliente_id", "clienteId")
      .addSelect("c.nombre || ' ' || c.apellido", "nombre")
      .addSelect("v.resultado", "resultado")
      .from("visitas", "v")
      .innerJoin("clientes", "c", "c.id = v.cliente_id")
      .where("v.ruta_id = :rutaId", { rutaId })
      .andWhere("v.fecha = :fecha", { fecha })
      .andWhere("v.resultado IN ('pago', 'no_pago')")
      .orderBy("v.cliente_id", "ASC")
      .getRawMany<{ clienteId: string; nombre: string; resultado: "pago" | "no_pago" }>();
    return filas.map((f) => ({
      clienteId: Number(f.clienteId),
      nombre: f.nombre,
      resultado: f.resultado,
    }));
  }

  private async horasDeCuotas(
    rutaId: number,
    inicio: Date,
    fin: Date,
  ): Promise<{ horaInicio: string | null; horaFin: string | null }> {
    const fila = await this.dataSource.manager
      .createQueryBuilder()
      .select("MIN(pa.fecha_hora)", "primera")
      .addSelect("MAX(pa.fecha_hora)", "ultima")
      .from("pagos", "pa")
      .innerJoin("cuotas", "c", "c.id = pa.cuota_id")
      .innerJoin("prestamos", "p", "p.id = c.prestamo_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("pa.fecha_hora >= :inicio", { inicio })
      .andWhere("pa.fecha_hora <= :fin", { fin })
      .getRawOne<{ primera: Date | null; ultima: Date | null }>();

    return {
      horaInicio: fila?.primera ? this.horaLocal(new Date(fila.primera)) : null,
      horaFin: fila?.ultima ? this.horaLocal(new Date(fila.ultima)) : null,
    };
  }

  private async clientesNotificados(
    rutaId: number,
    fecha: string,
  ): Promise<ClienteBreve[]> {
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .addSelect("c.nombre || ' ' || c.apellido", "nombre")
      .addSelect("MAX(m.timestamp)", "ultimo")
      .from("mensajes_ia", "m")
      .innerJoin("conversaciones_ia", "conv", "conv.id = m.conversacion_id")
      .innerJoin("clientes", "c", "c.id = conv.cliente_id")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .andWhere("m.emisor = 'ia'")
      .andWhere("m.timestamp::date = :fecha", { fecha })
      .groupBy("c.id")
      .orderBy("c.id", "ASC")
      .getRawMany<{ clienteId: string; nombre: string; ultimo: Date }>();
    return filas.map((f) => ({
      clienteId: Number(f.clienteId),
      nombre: f.nombre,
      hora: this.horaLocal(new Date(f.ultimo)),
    }));
  }

  private async contarSinDeudaViva(rutaId: number, clienteIds: number[]): Promise<number> {
    if (clienteIds.length === 0) {
      return 0;
    }
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("DISTINCT c.id", "clienteId")
      .from("clientes", "c")
      .innerJoin("prestamos", "p", "p.cliente_id = c.id AND p.estatus = 'vigente'")
      .leftJoin(
        "cuotas",
        "cu",
        "cu.prestamo_id = p.id AND cu.estatus IN ('pendiente', 'atrasada')",
      )
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.id IN (:...clienteIds)", { clienteIds })
      .andWhere("cu.id IS NULL")
      .getRawMany<{ clienteId: string }>();
    return filas.length;
  }

  private unicos(visitas: VisitaDia[]): ClienteBreve[] {
    const vistos = new Map<number, ClienteBreve>();
    for (const visita of visitas) {
      if (!vistos.has(visita.clienteId)) {
        vistos.set(visita.clienteId, {
          clienteId: visita.clienteId,
          nombre: visita.nombre,
        });
      }
    }
    return [...vistos.values()];
  }

  private toHistorialPublic(r: ReporteDiario): ReporteDiarioHistorialPublic {
    return {
      id: r.id,
      rutaId: r.rutaId,
      fecha: r.fecha,
      cobradoDia: r.cobradoDia,
      prestadoDia: r.prestadoDia,
      clientesVisitados: (r.clientesVisitadosJson as ClienteBreve[] | null) ?? [],
      clientesSinPago: (r.clientesSinPagoJson as ClienteBreve[] | null) ?? [],
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
    };
  }

  private horaLocal(d: Date): string {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}
