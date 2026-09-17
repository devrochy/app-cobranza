import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { CobroPropietario } from "./cobro-propietario.entity";
import { addDays } from "./cobro-fecha";
import { ConversacionPropietario } from "./conversacion-propietario.entity";
import { MensajePropietario, MensajePropietarioSubtipo } from "./mensaje-propietario.entity";

/**
 * Notificaciones del ciclo de cobro al propietario (HU-60): recordatorio antes del
 * vencimiento (dias_anticipacion_cobro del propietario), aviso el día del cobro,
 * confirmación al registrarse el pago y alerta si el cobro vence.
 * En el MVP local el "canal WhatsApp" del propietario es la persistencia en
 * `mensajes_propietario` (espejo del simulador de clientes); la integración real con
 * WhatsApp Cloud API es Fase 2 (PRD 6.1). Deduplica por subtipo y día.
 */
@Injectable()
export class NotificacionesPropietarioService {
  constructor(
    @InjectRepository(CobroPropietario)
    private readonly cobroRepo: Repository<CobroPropietario>,
    @InjectRepository(ConversacionPropietario)
    private readonly conversacionRepo: Repository<ConversacionPropietario>,
    @InjectRepository(MensajePropietario)
    private readonly mensajeRepo: Repository<MensajePropietario>,
  ) {}

  async ejecutarCiclo(hoy: Date = new Date()): Promise<void> {
    await this.ejecutarRecordatorios(hoy);
    await this.ejecutarAvisoDia(hoy);
    await this.ejecutarAlertasVencidos(hoy);
  }

  async ejecutarRecordatorios(hoy: Date = new Date()): Promise<number> {
    const cobros = await this.cobroRepo.find({
      where: { estado: "pendiente" },
      relations: { propietario: true },
    });

    let enviadas = 0;
    for (const cobro of cobros) {
      const dias = cobro.propietario?.diasAnticipacionCobro ?? 0;
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
      relations: { propietario: true },
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
      relations: { propietario: true },
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
      relations: { propietario: true },
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
    cobro: CobroPropietario,
    subtipo: MensajePropietarioSubtipo,
    contenido: string,
    hoy: Date,
  ): Promise<number> {
    const conversacion = await this.obtenerConversacion(cobro.propietarioId);
    if (await this.yaEnviado(conversacion.id, subtipo, hoy)) {
      return 0;
    }
    await this.mensajeRepo.save(
      this.mensajeRepo.create({
        conversacion: { id: conversacion.id } as ConversacionPropietario,
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
    subtipo: MensajePropietarioSubtipo,
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

  async obtenerConversacion(propietarioId: number): Promise<ConversacionPropietario> {
    const existente = await this.conversacionRepo.findOne({
      where: { propietario: { id: propietarioId }, estado: "activa" },
      order: { id: "DESC" },
    });
    if (existente) {
      return existente;
    }
    const nueva = this.conversacionRepo.create({
      propietario: { id: propietarioId } as ConversacionPropietario["propietario"],
      propietarioId,
      canal: "whatsapp",
      estado: "activa",
    });
    return this.conversacionRepo.save(nueva);
  }
}