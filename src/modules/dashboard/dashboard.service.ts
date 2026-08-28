import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThanOrEqual, Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { Abono } from "../cartera/abono.entity";
import { Cliente } from "../cartera/cliente.entity";
import { Cuota } from "../cartera/cuota.entity";
import { Pago } from "../cartera/pago.entity";
import { Prestamo } from "../cartera/prestamo.entity";
import { Gasto } from "../rutas/gasto.entity";
import { Liquidacion } from "../rutas/liquidacion.entity";
import { Ruta } from "../rutas/ruta.entity";
import { Socio } from "../socios/socio.entity";

export interface DashboardPublic {
  carteraActiva: number;
  moraTotal: number;
  cobradoDia: number;
  cobradoSemana: number;
  gastosPeriodo: number;
  comisionesPeriodo: number;
  rutasActivas: number;
  sociosActivos: number;
  clientesActivos: number;
  prestamosVigentes: number;
}

/**
 * Dashboard consolidado multi-ruta (HU-23). Semántica (documentada, ajustable):
 * - carteraActiva: suma del valor esperado de cuotas pendiente/atrasada de préstamos vigentes.
 * - moraTotal: suma del valor esperado de cuotas atrasadas.
 * - cobradoDia/cobradoSemana: suma de pagos + abonos con fecha_hora en el día / últimos 7 días.
 * - gastosPeriodo: suma de gastos aprobados del mes actual.
 * - comisionesPeriodo: suma de comisión de liquidaciones del mes actual.
 * Admite filtros opcionales `rutaId`/`socioId` para acotar los agregados.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Abono)
    private readonly abonoRepo: Repository<Abono>,
    @InjectRepository(Gasto)
    private readonly gastoRepo: Repository<Gasto>,
    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {}

  async obtener(
    hoy: Date = new Date(),
    filtros: { rutaId?: number; socioId?: number } = {},
  ): Promise<DashboardPublic> {
    const inicioDia = this.inicioDeDia(hoy);
    const inicioSemana = this.restarDias(inicioDia, 6);
    const inicioMes = this.inicioDeMes(hoy);
    const inicioMesStr = formatDate(inicioMes);

    const rutaIds = await this.resolverRutaIds(filtros);
    const filtroRuta = rutaIds ? { ruta: { id: In(rutaIds) } } : {};
    const filtroRutaId = rutaIds ? { rutaId: In(rutaIds) } : {};
    // Pago no tiene ruta directa (vía Cliente); Abono la tiene vía Prestamo.
    const filtroPago = rutaIds ? { cliente: { rutaId: In(rutaIds) } } : {};
    const filtroAbono = rutaIds ? { prestamo: { rutaId: In(rutaIds) } } : {};

    const [carteraActiva, moraTotal] = await Promise.all([
      this.cuotaRepo.sum("valorEsperado", {
        estatus: In(["pendiente", "atrasada"]),
        prestamo: { estatus: "vigente", ...filtroRuta },
      }),
      this.cuotaRepo.sum("valorEsperado", {
        estatus: "atrasada",
        prestamo: { estatus: "vigente", ...filtroRuta },
      }),
    ]);

    const [pagosDia, abonosDia, pagosSemana, abonosSemana] = await Promise.all([
      this.pagoRepo.sum("valor", {
        fechaHora: MoreThanOrEqual(inicioDia),
        ...filtroPago,
      }),
      this.abonoRepo.sum("valor", {
        fechaHora: MoreThanOrEqual(inicioDia),
        ...filtroAbono,
      }),
      this.pagoRepo.sum("valor", {
        fechaHora: MoreThanOrEqual(inicioSemana),
        ...filtroPago,
      }),
      this.abonoRepo.sum("valor", {
        fechaHora: MoreThanOrEqual(inicioSemana),
        ...filtroAbono,
      }),
    ]);

    const [gastosPeriodo, comisionesPeriodo] = await Promise.all([
      this.gastoRepo.sum("valor", {
        aprobado: true,
        estado: "activo",
        fechaHora: MoreThanOrEqual(inicioMes),
        ...filtroRutaId,
      }),
      this.liquidacionRepo.sum("comisionValor", {
        fecha: MoreThanOrEqual(inicioMesStr),
        ...filtroRutaId,
      }),
    ]);

    const socioIds = await this.resolverSocioIds(rutaIds, filtros.socioId);
    const filtroSocio = socioIds ? { id: In(socioIds) } : {};
    const [rutasActivas, sociosActivos, clientesActivos, prestamosVigentes] =
      await Promise.all([
        this.rutaRepo.count({
          where: { estatus: "activo", ...filtroRutaId },
        }),
        this.socioRepo.count({
          where: { estatus: "activo", ...filtroSocio },
        }),
        this.clienteRepo.count({
          where: { estatus: "activo", ...filtroRutaId },
        }),
        this.prestamoRepo.count({
          where: { estatus: "vigente", ...filtroRutaId },
        }),
      ]);

    return {
      carteraActiva: Number(carteraActiva ?? 0),
      moraTotal: Number(moraTotal ?? 0),
      cobradoDia: Number(pagosDia ?? 0) + Number(abonosDia ?? 0),
      cobradoSemana: Number(pagosSemana ?? 0) + Number(abonosSemana ?? 0),
      gastosPeriodo: Number(gastosPeriodo ?? 0),
      comisionesPeriodo: Number(comisionesPeriodo ?? 0),
      rutasActivas,
      sociosActivos,
      clientesActivos,
      prestamosVigentes,
    };
  }

  private async resolverRutaIds(filtros: {
    rutaId?: number;
    socioId?: number;
  }): Promise<number[] | undefined> {
    if (filtros.rutaId) {
      return [filtros.rutaId];
    }
    if (filtros.socioId) {
      const rutas = await this.rutaRepo.find({
        where: { socioId: filtros.socioId },
      });
      return rutas.map((r) => r.id);
    }
    return undefined;
  }

  private async resolverSocioIds(
    rutaIds: number[] | undefined,
    socioId: number | undefined,
  ): Promise<number[] | undefined> {
    if (socioId) {
      return [socioId];
    }
    if (rutaIds) {
      const rutas = await this.rutaRepo.find({
        where: { id: In(rutaIds) },
        select: { socioId: true },
      });
      return [...new Set(rutas.map((r) => r.socioId))];
    }
    return undefined;
  }

  private inicioDeDia(fecha: Date): Date {
    return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  }

  private restarDias(fecha: Date, dias: number): Date {
    const resultado = new Date(fecha);
    resultado.setUTCDate(resultado.getUTCDate() - dias);
    return resultado;
  }

  private inicioDeMes(fecha: Date): Date {
    return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
  }
}