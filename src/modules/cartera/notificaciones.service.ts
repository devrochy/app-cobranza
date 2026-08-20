import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";

export interface EjecutarRecordatoriosInput {
  hoy?: Date;
  diasAnticipacion: number;
}

/**
 * Motor de notificaciones (Fase 4, ítem 23): agenda el envío de recordatorios de
 * pago (pre-vencimiento) a los clientes vía el gateway de WhatsApp, persistiendo
 * cada mensaje en `mensajes_ia`. El job diario lo invoca (patrón @nestjs/schedule).
 * La deduplicación y el ciclo completo (antes/durante/después) se completan en HU-52.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(ConversacionIa)
    private readonly conversacionRepo: Repository<ConversacionIa>,
    @Inject(WHATSAPP_GATEWAY)
    private readonly gateway: WhatsappGateway,
  ) {}

  async ejecutarRecordatorios(input: EjecutarRecordatoriosInput): Promise<number> {
    const hoy = input.hoy ?? new Date();
    const fechaObjetivo = new Date(hoy);
    fechaObjetivo.setDate(fechaObjetivo.getDate() + input.diasAnticipacion);
    const objetivoStr = formatDate(fechaObjetivo);

    const cuotas = await this.cuotaRepo.find({
      where: { estatus: "pendiente", fechaVencimiento: objetivoStr },
      relations: { prestamo: { cliente: true } },
    });

    let enviadas = 0;
    for (const cuota of cuotas) {
      const cliente = cuota.prestamo?.cliente;
      if (!cliente) continue;

      const conversacion = await this.obtenerConversacion(cliente);
      await this.gateway.enviarMensaje({
        conversacionId: conversacion.id,
        emisor: "ia",
        contenido: `Hola ${cliente.nombre}, recordatorio: tu cuota de ${cuota.valorEsperado} vence el ${cuota.fechaVencimiento}.`,
        telefono: cliente.telefonoWhatsapp,
      });
      enviadas += 1;
    }

    this.logger.log(`Notificaciones: ${enviadas} recordatorio(s) enviado(s)`);
    return enviadas;
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
