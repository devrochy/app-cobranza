import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import {
  construirEstadoCuentaPrestamo,
  construirTextoReporte,
  CuotaEstado,
  EstadoCuentaPrestamo,
} from "../../domain/estado-cuenta-prestamo";
import { Cartera } from "../carteras/cartera.entity";
import { Prestamo } from "./prestamo.entity";
import { Cuota } from "./cuota.entity";
import { Abono } from "./abono.entity";
import { Pago } from "./pago.entity";
import { NotificacionesService } from "./notificaciones.service";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";

export interface RequesterEstadoCuentaContext {
  rol: RolUsuario;
  sub: number;
}

export interface EstadoCuentaPrestamoPublic {
  prestamoId: number;
  carteraId: number;
  clienteId: number;
  nombreCliente: string;
  valor: number;
  numCuotas: number;
  tipoInteres: number;
  estatus: string;
  moneda: string;
  cuotas: CuotaEstado[];
  totalAbonos: number;
  saldoPendiente: number;
  proximoVencimiento: string | null;
}

/**
 * HU-54: estado de cuenta de un préstamo (datos del préstamo + recuadros por
 * cuota con saldos/abonos) y envío manual del reporte al cliente por WhatsApp
 * (gateway simulado). Reutiliza la infraestructura de conversación (ítems 23-25).
 */
@Injectable()
export class EstadoCuentaService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Abono)
    private readonly abonoRepo: Repository<Abono>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @Inject(WHATSAPP_GATEWAY)
    private readonly gateway: WhatsappGateway,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async obtener(
    carteraId: number,
    prestamoId: number,
    requester: RequesterEstadoCuentaContext,
  ): Promise<EstadoCuentaPrestamoPublic> {
    const { cartera, prestamo } = await this.acceder(carteraId, prestamoId, requester);
    const estado = await this.construirEstado(cartera, prestamo);
    return this.toPublic(cartera, prestamo, estado);
  }

  async enviarReporte(
    carteraId: number,
    prestamoId: number,
    requester: RequesterEstadoCuentaContext,
  ): Promise<{ conversacionId: number }> {
    const { cartera, prestamo } = await this.acceder(carteraId, prestamoId, requester);
    const estado = await this.construirEstado(cartera, prestamo);

    const nombreCliente = `${prestamo.cliente?.nombre ?? ""} ${prestamo.cliente?.apellido ?? ""}`.trim();
    const contenido = construirTextoReporte(
      {
        valor: prestamo.valor,
        numCuotas: prestamo.numCuotas,
        tipoInteres: prestamo.tipoInteres,
      },
      nombreCliente,
      estado,
      cartera.moneda,
    );

    const conversacion = await this.notificacionesService.obtenerConversacion(prestamo.cliente);

    await this.gateway.enviarMensaje({
      conversacionId: conversacion.id,
      emisor: "ia",
      contenido,
      telefono: prestamo.cliente?.telefonoWhatsapp,
      intencionDetectada: "reporte_estado_cuenta",
    });

    return { conversacionId: conversacion.id };
  }

  private async construirEstado(
    cartera: Cartera,
    prestamo: Prestamo,
  ): Promise<EstadoCuentaPrestamo> {
    const cuotas = await this.cuotaRepo.find({
      where: { prestamo: { id: prestamo.id } },
      order: { numeroCuota: "ASC" },
    });
    const abonos = await this.abonoRepo.find({ where: { prestamo: { id: prestamo.id } } });
    const pagos = await this.pagoRepo.find({
      where: { cuota: { prestamo: { id: prestamo.id } } },
    });

    return construirEstadoCuentaPrestamo(
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
      pagos.map((p) => ({
        id: p.id,
        cuotaId: p.cuotaId as number,
        valor: p.valor,
        fechaHora: p.fechaHora,
        liquidado: p.liquidado,
      })),
    );
  }

  private toPublic(
    cartera: Cartera,
    prestamo: Prestamo,
    estado: EstadoCuentaPrestamo,
  ): EstadoCuentaPrestamoPublic {
    return {
      prestamoId: prestamo.id,
      carteraId: cartera.id,
      clienteId: prestamo.clienteId,
      nombreCliente: `${prestamo.cliente?.nombre ?? ""} ${prestamo.cliente?.apellido ?? ""}`.trim(),
      valor: prestamo.valor,
      numCuotas: prestamo.numCuotas,
      tipoInteres: prestamo.tipoInteres,
      estatus: prestamo.estatus,
      moneda: cartera.moneda,
      cuotas: estado.cuotas,
      totalAbonos: estado.totalAbonos,
      saldoPendiente: estado.saldoPendiente,
      proximoVencimiento: estado.proximoVencimiento,
    };
  }

  private async acceder(
    carteraId: number,
    prestamoId: number,
    requester: RequesterEstadoCuentaContext,
  ): Promise<{ cartera: Cartera; prestamo: Prestamo }> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const prestamo = await this.prestamoRepo.findOne({
      where: { id: prestamoId, cartera: { id: carteraId } },
      relations: { cliente: true },
    });
    if (!prestamo) {
      throw new NotFoundException("El préstamo no existe en esta cartera");
    }

    return { cartera, prestamo };
  }
}
