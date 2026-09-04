import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import {
  construirEstadoCuentaPrestamo,
} from "../../domain/estado-cuenta-prestamo";
import { Ruta } from "../rutas/ruta.entity";
import { Prestamo } from "./prestamo.entity";
import { Cuota } from "./cuota.entity";
import { Pago } from "./pago.entity";
import { Abono } from "./abono.entity";
import { Visita } from "./visita.entity";

export interface PagoDetalleCuotaPublic {
  id: number;
  valor: number;
  metodoPago: string;
  fechaHora: string;
  registradoPor: number | null;
  liquidado: boolean;
}

export interface AbonoDetalleCuotaPublic {
  id: number;
  valor: number;
  fechaHora: string;
  liquidado: boolean;
}

export interface VisitaDetalleCuotaPublic {
  id: number;
  fecha: string;
  resultado: string;
  motivoNoPago: string | null;
  valorPagado: number | null;
  metodoPago: string | null;
}

export interface DetalleCuotaPublic {
  cuotaId: number;
  numeroCuota: number;
  valorEsperado: number;
  fechaVencimiento: string;
  estatus: string;
  abonosAcumulados: number;
  saldoPendiente: number;
  pagos: PagoDetalleCuotaPublic[];
  abonos: AbonoDetalleCuotaPublic[];
  ultimaVisita: VisitaDetalleCuotaPublic | null;
}

export interface RequesterDetalleCuotaContext {
  rol: RolUsuario;
  sub: number;
}

/**
 * HU-54/46: detalle de una cuota para el modal de la APK. Devuelve los pagos
 * aplicados a la cuota (pagos con cuotaId), el saldo/abonos calculados con la
 * misma imputación FIFO del estado de cuenta (construirEstadoCuentaPrestamo)
 * y la última visita del préstamo (resultado y motivo de no pago).
 */
@Injectable()
export class DetalleCuotaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Abono)
    private readonly abonoRepo: Repository<Abono>,
    @InjectRepository(Visita)
    private readonly visitaRepo: Repository<Visita>,
  ) {}

  async obtener(
    rutaId: number,
    prestamoId: number,
    cuotaId: number,
    requester: RequesterDetalleCuotaContext,
  ): Promise<DetalleCuotaPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const prestamo = await this.prestamoRepo.findOne({
      where: { id: prestamoId, ruta: { id: rutaId } },
      relations: { cliente: true },
    });
    if (!prestamo) {
      throw new NotFoundException("El préstamo no existe en esta ruta");
    }

    const cuota = await this.cuotaRepo.findOne({
      where: { id: cuotaId, prestamo: { id: prestamoId } },
    });
    if (!cuota) {
      throw new NotFoundException("La cuota no existe en este préstamo");
    }

    const [cuotas, pagos, abonos, visitas] = await Promise.all([
      this.cuotaRepo.find({
        where: { prestamo: { id: prestamoId } },
        order: { numeroCuota: "ASC" },
      }),
      this.pagoRepo.find({
        where: { cuota: { id: cuotaId } },
        order: { fechaHora: "ASC" },
      }),
      this.abonoRepo.find({
        where: { prestamo: { id: prestamoId } },
        order: { fechaHora: "ASC" },
      }),
      this.visitaRepo.find({
        where: { prestamoPrincipal: { id: prestamoId } },
        order: { id: "DESC" },
      }),
    ]);

    const estado = construirEstadoCuentaPrestamo(
      {
        valor: prestamo.valor,
        numCuotas: prestamo.numCuotas,
        tipoInteres: prestamo.tipoInteres,
      },
      cuotas.map((c) => ({
        cuotaId: c.id,
        numeroCuota: c.numeroCuota,
        valorEsperado: c.valorEsperado,
        fechaVencimiento: c.fechaVencimiento,
        estatus: c.estatus,
      })),
      abonos.map((a) => ({ valor: a.valor })),
    );
    const cuotaEstado = estado.cuotas.find((c) => c.cuotaId === cuotaId);

    const ultimaVisita = visitas[0] ?? null;

    return {
      cuotaId: cuota.id,
      numeroCuota: cuota.numeroCuota,
      valorEsperado: cuota.valorEsperado,
      fechaVencimiento: cuota.fechaVencimiento,
      estatus: cuota.estatus,
      abonosAcumulados: cuotaEstado?.abonosAcumulados ?? 0,
      saldoPendiente: cuotaEstado?.saldoPendiente ?? cuota.valorEsperado,
      pagos: pagos.map((p) => ({
        id: p.id,
        valor: p.valor,
        metodoPago: p.metodoPago,
        fechaHora: p.fechaHora.toISOString(),
        registradoPor: p.registradoPor,
        liquidado: p.liquidado,
      })),
      abonos: abonos.map((a) => ({
        id: a.id,
        valor: a.valor,
        fechaHora: a.fechaHora.toISOString(),
        liquidado: a.liquidado,
      })),
      ultimaVisita: ultimaVisita
        ? {
            id: ultimaVisita.id,
            fecha: ultimaVisita.fecha,
            resultado: ultimaVisita.resultado,
            motivoNoPago: ultimaVisita.motivoNoPago,
            valorPagado: ultimaVisita.valorPagado,
            metodoPago: ultimaVisita.metodoPago,
          }
        : null,
    };
  }
}