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
import { Ruta } from "../rutas/ruta.entity";
import { Prestamo } from "./prestamo.entity";
import { Cuota } from "./cuota.entity";
import { Abono } from "./abono.entity";
import { NotificacionesService } from "./notificaciones.service";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";

export interface RequesterEstadoCuentaContext {
  rol: RolUsuario;
  sub: number;
}

export interface EstadoCuentaPrestamoPublic {
  prestamoId: number;
  rutaId: number;
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
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Abono)
    private readonly abonoRepo: Repository<Abono>,
    @Inject(WHATSAPP_GATEWAY)
    private readonly gateway: WhatsappGateway,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async obtener(
    rutaId: number,
    prestamoId: number,
    requester: RequesterEstadoCuentaContext,
  ): Promise<EstadoCuentaPrestamoPublic> {
    const { ruta, prestamo } = await this.acceder(rutaId, prestamoId, requester);
    const estado = await this.construirEstado(ruta, prestamo);
    return this.toPublic(ruta, prestamo, estado);
  }

  async enviarReporte(
    rutaId: number,
    prestamoId: number,
    requester: RequesterEstadoCuentaContext,
  ): Promise<{ conversacionId: number }> {
    const { ruta, prestamo } = await this.acceder(rutaId, prestamoId, requester);
    const estado = await this.construirEstado(ruta, prestamo);

    const nombreCliente = `${prestamo.cliente?.nombre ?? ""} ${prestamo.cliente?.apellido ?? ""}`.trim();
    const contenido = construirTextoReporte(
      {
        valor: prestamo.valor,
        numCuotas: prestamo.numCuotas,
        tipoInteres: prestamo.tipoInteres,
      },
      nombreCliente,
      estado,
      ruta.moneda,
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
    ruta: Ruta,
    prestamo: Prestamo,
  ): Promise<EstadoCuentaPrestamo> {
    const cuotas = await this.cuotaRepo.find({
      where: { prestamo: { id: prestamo.id } },
      order: { numeroCuota: "ASC" },
    });
    const abonos = await this.abonoRepo.find({ where: { prestamo: { id: prestamo.id } } });

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
    );
  }

  private toPublic(
    ruta: Ruta,
    prestamo: Prestamo,
    estado: EstadoCuentaPrestamo,
  ): EstadoCuentaPrestamoPublic {
    return {
      prestamoId: prestamo.id,
      rutaId: ruta.id,
      clienteId: prestamo.clienteId,
      nombreCliente: `${prestamo.cliente?.nombre ?? ""} ${prestamo.cliente?.apellido ?? ""}`.trim(),
      valor: prestamo.valor,
      numCuotas: prestamo.numCuotas,
      tipoInteres: prestamo.tipoInteres,
      estatus: prestamo.estatus,
      moneda: ruta.moneda,
      cuotas: estado.cuotas,
      totalAbonos: estado.totalAbonos,
      saldoPendiente: estado.saldoPendiente,
      proximoVencimiento: estado.proximoVencimiento,
    };
  }

  private async acceder(
    rutaId: number,
    prestamoId: number,
    requester: RequesterEstadoCuentaContext,
  ): Promise<{ ruta: Ruta; prestamo: Prestamo }> {
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

    return { ruta, prestamo };
  }
}
