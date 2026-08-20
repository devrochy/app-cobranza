import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { MensajeIa } from "./mensaje-ia.entity";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";

export interface EjecutarRecordatoriosInput {
  rutaId: number;
  hoy?: Date;
}

export interface EjecutarConFechaInput {
  hoy?: Date;
}

export type TipoNotificacion =
  | "recordatorio"
  | "aviso_dia_cobro"
  | "confirmacion_pago"
  | "alerta_mora";

/**
 * Motor de notificaciones (Fase 4, ítems 23-24): agenda el envío de
 * notificaciones de pago de cuota en ciclo completo (antes/durante/después) con
 * config por ruta (dias_anticipacion_notificacion, aviso_dia_cobro,
 * umbral_mora_notificacion). Persiste cada mensaje en `mensajes_ia` (con
 * intencion_detectada = tipo) y deduplica por tipo y día.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(ConversacionIa)
    private readonly conversacionRepo: Repository<ConversacionIa>,
    @InjectRepository(MensajeIa)
    private readonly mensajeRepo: Repository<MensajeIa>,
    @InjectRepository(RutaConfig)
    private readonly configRepo: Repository<RutaConfig>,
    @Inject(WHATSAPP_GATEWAY)
    private readonly gateway: WhatsappGateway,
  ) {}

  async ejecutarRecordatorios(input: EjecutarRecordatoriosInput): Promise<number> {
    const hoy = input.hoy ?? new Date();
    const config = await this.configRepo.findOne({ where: { ruta: { id: input.rutaId } } });
    const diasAnticipacion = config?.diasAnticipacionNotificacion ?? 0;
    if (diasAnticipacion <= 0) {
      return 0;
    }

    const fechaObjetivo = new Date(hoy);
    fechaObjetivo.setDate(fechaObjetivo.getDate() + diasAnticipacion);
    const objetivoStr = formatDate(fechaObjetivo);

    const cuotas = await this.cuotaRepo.find({
      where: {
        estatus: "pendiente",
        fechaVencimiento: objetivoStr,
        prestamo: { ruta: { id: input.rutaId } },
      },
      relations: { prestamo: { cliente: true } },
    });

    return this.enviarPorCuota(cuotas, "recordatorio", (cuota) =>
      `Hola ${cuota.prestamo?.cliente?.nombre}, recordatorio: tu cuota de ${cuota.valorEsperado} vence el ${cuota.fechaVencimiento}.`,
      hoy,
    );
  }

  async ejecutarAvisoDiaCobro(rutaId: number, input: EjecutarConFechaInput = {}): Promise<number> {
    const hoy = input.hoy ?? new Date();
    const config = await this.configRepo.findOne({ where: { ruta: { id: rutaId } } });
    if (!config?.avisoDiaCobro) {
      return 0;
    }

    const hoyStr = formatDate(hoy);
    const cuotas = await this.cuotaRepo.find({
      where: { estatus: "pendiente", fechaVencimiento: hoyStr, prestamo: { ruta: { id: rutaId } } },
      relations: { prestamo: { cliente: true } },
    });

    return this.enviarPorCuota(cuotas, "aviso_dia_cobro", (cuota) =>
      `Hola ${cuota.prestamo?.cliente?.nombre}, tu cuota de ${cuota.valorEsperado} vence hoy (${cuota.fechaVencimiento}).`,
      hoy,
    );
  }

  async ejecutarAlertaMora(rutaId: number, input: EjecutarConFechaInput = {}): Promise<number> {
    const hoy = input.hoy ?? new Date();
    const config = await this.configRepo.findOne({ where: { ruta: { id: rutaId } } });
    const umbral = config?.umbralMoraNotificacion ?? 0;

    const cuotas = await this.cuotaRepo.find({
      where: { estatus: "atrasada", prestamo: { ruta: { id: rutaId } } },
      relations: { prestamo: { cliente: true } },
    });

    // Agrupar por cliente y enviar alerta si el nº de cuotas atrasadas >= umbral.
    const porCliente = new Map<number, { cliente: Cliente; atraso: number }>();
    for (const cuota of cuotas) {
      const cliente = cuota.prestamo?.cliente;
      if (!cliente) continue;
      const actual = porCliente.get(cliente.id) ?? { cliente, atraso: 0 };
      actual.atraso += 1;
      porCliente.set(cliente.id, actual);
    }

    let enviadas = 0;
    for (const { cliente, atraso } of porCliente.values()) {
      if (atraso < umbral) continue;
      const conversacion = await this.obtenerConversacion(cliente);
      if (await this.yaEnviado(conversacion.id, "alerta_mora", hoy)) {
        continue;
      }
      await this.gateway.enviarMensaje({
        conversacionId: conversacion.id,
        emisor: "ia",
        contenido: `Hola ${cliente.nombre}, tienes ${atraso} cuota(s) en mora. Contacta para regularizar tu pago.`,
        telefono: cliente.telefonoWhatsapp,
        intencionDetectada: "alerta_mora",
      });
      enviadas += 1;
    }

    this.logger.log(`Notificaciones: ${enviadas} alerta(s) de mora enviada(s)`);
    return enviadas;
  }

  async enviarConfirmacionPago(
    cliente: Cliente,
    valor: number,
    hoy: Date = new Date(),
  ): Promise<void> {
    if (!cliente) return;
    const conversacion = await this.obtenerConversacion(cliente);
    if (await this.yaEnviado(conversacion.id, "confirmacion_pago", hoy)) {
      return;
    }
    await this.gateway.enviarMensaje({
      conversacionId: conversacion.id,
      emisor: "ia",
      contenido: `Hola ${cliente.nombre}, confirmamos tu pago de ${valor}. Gracias.`,
      telefono: cliente.telefonoWhatsapp,
      intencionDetectada: "confirmacion_pago",
    });
  }

  private async enviarPorCuota(
    cuotas: Cuota[],
    tipo: "recordatorio" | "aviso_dia_cobro",
    construirContenido: (cuota: Cuota) => string,
    hoy: Date,
  ): Promise<number> {
    let enviadas = 0;
    for (const cuota of cuotas) {
      const cliente = cuota.prestamo?.cliente;
      if (!cliente) continue;
      const conversacion = await this.obtenerConversacion(cliente);
      if (await this.yaEnviado(conversacion.id, tipo, hoy)) {
        continue;
      }
      await this.gateway.enviarMensaje({
        conversacionId: conversacion.id,
        emisor: "ia",
        contenido: construirContenido(cuota),
        telefono: cliente.telefonoWhatsapp,
        intencionDetectada: tipo,
      });
      enviadas += 1;
    }
    this.logger.log(`Notificaciones: ${enviadas} mensaje(s) tipo ${tipo} enviado(s)`);
    return enviadas;
  }

  private async yaEnviado(conversacionId: number, tipo: TipoNotificacion, hoy: Date): Promise<boolean> {
    const hoyStr = formatDate(hoy);
    return this.mensajeRepo
      .createQueryBuilder("m")
      .where("m.conversacion_id = :conversacionId", { conversacionId })
      .andWhere("m.intencion_detectada = :tipo", { tipo })
      .andWhere("m.timestamp::date = :hoy", { hoy: hoyStr })
      .getExists();
  }

  private async obtenerConversacion(cliente: Cliente): Promise<ConversacionIa> {
    const existente = await this.conversacionRepo.findOne({
      where: { cliente: { id: cliente.id }, estado: "activa" },
    });
    if (existente) {
      return existente;
    }
    const nueva = this.conversacionRepo.create({
      cliente: { id: cliente.id } as Cliente,
      clienteId: cliente.id,
      canal: "whatsapp",
      estado: "activa",
      motivoDerivacion: null,
      agenteAsignadoId: null,
      closedAt: null,
    });
    return this.conversacionRepo.save(nueva);
  }
}
