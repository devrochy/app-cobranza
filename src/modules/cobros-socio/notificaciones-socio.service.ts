import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { CobroSocio } from "./cobro-socio.entity";
import { addDays } from "./cobro-fecha";
import { ConversacionSocio } from "./conversacion-socio.entity";
import { MensajeSocio, MensajeSocioSubtipo } from "./mensaje-socio.entity";

/**
 * Notificaciones del ciclo de cobro al socio (HU-60): recordatorio antes del
 * vencimiento (dias_anticipacion_cobro del socio), aviso el día del cobro,
 * confirmación al registrarse el pago y alerta si el cobro vence.
 * En el MVP local el "canal WhatsApp" del socio es la persistencia en
 * `mensajes_socio` (espejo del simulador de clientes); la integración real con
 * WhatsApp Cloud API es Fase 2 (PRD 6.1). Deduplica por subtipo y día.
 */
@Injectable()
export class NotificacionesSocioService {
  constructor(
    @InjectRepository(CobroSocio)
    private readonly cobroRepo: Repository<CobroSocio>,
    @InjectRepository(ConversacionSocio)
    private readonly conversacionRepo: Repository<ConversacionSocio>,
    @InjectRepository(MensajeSocio)
    private readonly mensajeRepo: Repository<MensajeSocio>,
  ) {}

  async ejecutarCiclo(hoy: Date = new Date()): Promise<void> {
    await this.ejecutarRecordatorios(hoy);
    await this.ejecutarAvisoDia(hoy);
    await this.ejecutarAlertasVencidos(hoy);
  }

  async ejecutarRecordatorios(hoy: Date = new Date()): Promise<number> {
    const cobros = await this.cobroRepo.find({
      where: { estado: "pendiente" },
      relations: { socio: true },
    });

    let enviadas = 0;
    for (const cobro of cobros) {
      const dias = cobro.socio?.diasAnticipacionCobro ?? 0;
      if (dias <= 0) continue;
      if (cobro.fechaVencimiento !== formatDate(addDays(hoy, dias))) continue;
      enviadas += await this.enviar(
        cobro,
        "recordatorio",
        `Recordatorio: tu cobro mensual de ${cobro.montoCalculado} vence el ${cobro.fechaVencimiento}.`,
        hoy,
      );
    }
    return enviadas;
  }

  async ejecutarAvisoDia(hoy: Date = new Date()): Promise<number> {
    const hoyStr = formatDate(hoy);
    const cobros = await this.cobroRepo.find({
      where: { estado: "pendiente", fechaVencimiento: hoyStr },
      relations: { socio: true },
    });

    let enviadas = 0;
    for (const cobro of cobros) {
      enviadas += await this.enviar(
        cobro,
        "aviso_dia",
        `Hoy vence tu cobro mensual de ${cobro.montoCalculado}.`,
        hoy,
      );
    }
    return enviadas;
  }

  async ejecutarAlertasVencidos(hoy: Date = new Date()): Promise<number> {
    const cobros = await this.cobroRepo.find({
      where: { estado: "vencido" },
      relations: { socio: true },
    });

    let enviadas = 0;
    for (const cobro of cobros) {
      enviadas += await this.enviar(
        cobro,
        "alerta_vencido",
        `Tu cobro mensual de ${cobro.montoCalculado} venció el ${cobro.fechaVencimiento}. Regulariza tu pago.`,
        hoy,
      );
    }
    return enviadas;
  }

  async confirmarPago(cobroId: number, montoPagado: number): Promise<void> {
    const cobro = await this.cobroRepo.findOne({
      where: { id: cobroId },
      relations: { socio: true },
    });
    if (!cobro) return;
    await this.enviar(
      cobro,
      "confirmacion_pago",
      `Confirmamos tu pago de ${montoPagado}. Gracias.`,
      new Date(),
    );
  }

  private async enviar(
    cobro: CobroSocio,
    subtipo: MensajeSocioSubtipo,
    contenido: string,
    hoy: Date,
  ): Promise<number> {
    const conversacion = await this.obtenerConversacion(cobro.socioId);
    if (await this.yaEnviado(conversacion.id, subtipo, hoy)) {
      return 0;
    }
    await this.mensajeRepo.save(
      this.mensajeRepo.create({
        conversacion: { id: conversacion.id } as ConversacionSocio,
        conversacionId: conversacion.id,
        emisor: "sistema",
        contenido,
        tipo: "notificacion_cobro",
        subtipo,
      }),
    );
    return 1;
  }

  private async yaEnviado(
    conversacionId: number,
    subtipo: MensajeSocioSubtipo,
    hoy: Date,
  ): Promise<boolean> {
    const hoyStr = formatDate(hoy);
    return this.mensajeRepo
      .createQueryBuilder("m")
      .where("m.conversacion_id = :conversacionId", { conversacionId })
      .andWhere("m.tipo = 'notificacion_cobro'")
      .andWhere("m.subtipo = :subtipo", { subtipo })
      .andWhere("m.timestamp::date = :hoy", { hoy: hoyStr })
      .getExists();
  }

  async obtenerConversacion(socioId: number): Promise<ConversacionSocio> {
    const existente = await this.conversacionRepo.findOne({
      where: { socio: { id: socioId }, estado: "activa" },
      order: { id: "DESC" },
    });
    if (existente) {
      return existente;
    }
    const nueva = this.conversacionRepo.create({
      socio: { id: socioId } as ConversacionSocio["socio"],
      socioId,
      canal: "whatsapp",
      estado: "activa",
    });
    return this.conversacionRepo.save(nueva);
  }
}