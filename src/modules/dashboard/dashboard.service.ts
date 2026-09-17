import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThanOrEqual, Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { Abono } from "../clientes/abono.entity";
import { Cliente } from "../clientes/cliente.entity";
import { Cuota } from "../clientes/cuota.entity";
import { Pago } from "../clientes/pago.entity";
import { Prestamo } from "../clientes/prestamo.entity";
import { Gasto } from "../carteras/gasto.entity";
import { Liquidacion } from "../carteras/liquidacion.entity";
import { Cartera } from "../carteras/cartera.entity";
import { Propietario } from "../propietarios/propietario.entity";

export interface DashboardPublic {
  carteraActiva: number;
  moraTotal: number;
  cobradoDia: number;
  cobradoSemana: number;
  gastosPeriodo: number;
  comisionesPeriodo: number;
  carterasActivas: number;
  propietariosActivos: number;
  clientesActivos: number;
  prestamosVigentes: number;
}

export interface DashboardSerieDia {
  fecha: string;
  cobrado: number;
  gastos: number;
}

export interface DashboardSeries {
  dias: DashboardSerieDia[];
}

/**
 * Dashboard consolidado multi-cartera (HU-23). Semántica (documentada, ajustable):
 * - carteraActiva: suma del valor esperado de cuotas pendiente/atrasada de préstamos vigentes.
 * - moraTotal: suma del valor esperado de cuotas atrasadas.
 * - cobradoDia/cobradoSemana: suma de pagos + abonos con fecha_hora en el día / últimos 7 días.
 * - gastosPeriodo: suma de gastos aprobados del mes actual.
 * - comisionesPeriodo: suma de comisión de liquidaciones del mes actual.
 * Admite filtros opcionales `carteraId`/`propietarioId` para acotar los agregados.
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
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {}

  async obtener(
    hoy: Date = new Date(),
    filtros: { carteraId?: number; propietarioId?: number } = {},
  ): Promise<DashboardPublic> {
    const inicioDia = this.inicioDeDia(hoy);
    const inicioSemana = this.restarDias(inicioDia, 6);
    const inicioMes = this.inicioDeMes(hoy);
    const inicioMesStr = formatDate(inicioMes);

    const carteraIds = await this.resolverCarteraIds(filtros);
    // TypeORM no resuelve RelationId (`carteraId`) en filtros de sum/count: se usa
    // siempre la relación `cartera.id`. `carterasActivas` filtra por `id` (es Cartera).
    const filtroCartera = carteraIds ? { cartera: { id: In(carteraIds) } } : {};
    const filtroCarteraEsId = carteraIds ? { id: In(carteraIds) } : {};
    const filtroPago = carteraIds ? { cliente: { cartera: { id: In(carteraIds) } } } : {};
    const filtroAbono = carteraIds ? { prestamo: { cartera: { id: In(carteraIds) } } } : {};

    const [carteraActiva, moraTotal] = await Promise.all([
      this.cuotaRepo.sum("valorEsperado", {
        estatus: In(["pendiente", "atrasada"]),
        prestamo: { estatus: "vigente", ...filtroCartera },
      }),
      this.cuotaRepo.sum("valorEsperado", {
        estatus: "atrasada",
        prestamo: { estatus: "vigente", ...filtroCartera },
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
        ...filtroCartera,
      }),
      this.liquidacionRepo.sum("comisionValor", {
        fecha: MoreThanOrEqual(inicioMesStr),
        ...filtroCartera,
      }),
    ]);

    const propietarioIds = await this.resolverPropietarioIds(carteraIds, filtros.propietarioId);
    const filtroPropietario = propietarioIds ? { id: In(propietarioIds) } : {};
    const [carterasActivas, propietariosActivos, clientesActivos, prestamosVigentes] =
      await Promise.all([
        this.carteraRepo.count({
          where: { estatus: "activo", ...filtroCarteraEsId },
        }),
        this.propietarioRepo.count({
          where: { estatus: "activo", ...filtroPropietario },
        }),
        this.clienteRepo.count({
          where: { estatus: "activo", ...filtroCartera },
        }),
        this.prestamoRepo.count({
          where: { estatus: "vigente", ...filtroCartera },
        }),
      ]);

    return {
      carteraActiva: Number(carteraActiva ?? 0),
      moraTotal: Number(moraTotal ?? 0),
      cobradoDia: Number(pagosDia ?? 0) + Number(abonosDia ?? 0),
      cobradoSemana: Number(pagosSemana ?? 0) + Number(abonosSemana ?? 0),
      gastosPeriodo: Number(gastosPeriodo ?? 0),
      comisionesPeriodo: Number(comisionesPeriodo ?? 0),
      carterasActivas,
      propietariosActivos,
      clientesActivos,
      prestamosVigentes,
    };
  }

  /**
   * Serie histórica diaria (los últimos `dias`): cobrado (pagos + abonos) y
   * gastos aprobados por día, con los días sin movimiento en 0. Acepta los
   * mismos filtros que `obtener` (carteraId/propietarioId).
   */
  async series(
    hoy: Date = new Date(),
    filtros: { carteraId?: number; propietarioId?: number } = {},
    dias = 14,
  ): Promise<DashboardSeries> {
    const fin = this.inicioDeDia(hoy);
    const inicio = this.restarDias(fin, dias - 1);

    const carteraIds = await this.resolverCarteraIds(filtros);
    const filtroCartera = carteraIds ? { cartera: { id: In(carteraIds) } } : {};
    const filtroPago = carteraIds ? { cliente: { cartera: { id: In(carteraIds) } } } : {};
    const filtroAbono = carteraIds ? { prestamo: { cartera: { id: In(carteraIds) } } } : {};

    const [pagos, abonos, gastos] = await Promise.all([
      this.pagoRepo.find({
        where: { fechaHora: MoreThanOrEqual(inicio), ...filtroPago },
        select: { valor: true, fechaHora: true },
      }),
      this.abonoRepo.find({
        where: { fechaHora: MoreThanOrEqual(inicio), ...filtroAbono },
        select: { valor: true, fechaHora: true },
      }),
      this.gastoRepo.find({
        where: {
          aprobado: true,
          estado: "activo",
          fechaHora: MoreThanOrEqual(inicio),
          ...filtroCartera,
        },
        select: { valor: true, fechaHora: true },
      }),
    ]);

    const acumulado = new Map<string, { cobrado: number; gastos: number }>();
    const sumar = (
      filas: { valor: number; fechaHora: Date }[],
      campo: "cobrado" | "gastos",
    ) => {
      for (const fila of filas) {
        const fecha = formatDate(fila.fechaHora);
        const actual = acumulado.get(fecha) ?? { cobrado: 0, gastos: 0 };
        actual[campo] += Number(fila.valor ?? 0);
        acumulado.set(fecha, actual);
      }
    };
    sumar(pagos, "cobrado");
    sumar(abonos, "cobrado");
    sumar(gastos, "gastos");

    const serie: DashboardSerieDia[] = [];
    for (let i = 0; i < dias; i++) {
      const fecha = formatDate(this.sumarDias(inicio, i));
      const valor = acumulado.get(fecha) ?? { cobrado: 0, gastos: 0 };
      serie.push({ fecha, cobrado: valor.cobrado, gastos: valor.gastos });
    }

    return { dias: serie };
  }

  private async resolverCarteraIds(filtros: {
    carteraId?: number;
    propietarioId?: number;
  }): Promise<number[] | undefined> {
    if (filtros.carteraId) {
      return [filtros.carteraId];
    }
    if (filtros.propietarioId) {
      const carteras = await this.carteraRepo.find({
        where: { propietario: { id: filtros.propietarioId } },
      });
      return carteras.map((r) => r.id);
    }
    return undefined;
  }

  private async resolverPropietarioIds(
    carteraIds: number[] | undefined,
    propietarioId: number | undefined,
  ): Promise<number[] | undefined> {
    if (propietarioId) {
      return [propietarioId];
    }
    if (carteraIds) {
      // `select` con RelationId no resuelve en TypeORM: se cargan las carteras y
      // se lee `propietarioId` desde la entidad (columna persistida).
      const carteras = await this.carteraRepo.find({
        where: { id: In(carteraIds) },
      });
      return [...new Set(carteras.map((r) => r.propietarioId))];
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

  private sumarDias(fecha: Date, dias: number): Date {
    const resultado = new Date(fecha);
    resultado.setUTCDate(resultado.getUTCDate() + dias);
    return resultado;
  }

  private inicioDeMes(fecha: Date): Date {
    return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
  }
}