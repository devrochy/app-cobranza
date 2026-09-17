import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { generarLinkWaMe } from "../../domain/wa-me";
import { Cartera } from "../carteras/cartera.entity";
import { Cliente } from "./cliente.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { MensajeIa } from "./mensaje-ia.entity";
import { NotificacionesService } from "./notificaciones.service";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";

export interface RequesterChatContext {
  rol: RolUsuario;
  sub: number;
}

export interface MensajeChatPublic {
  id: number;
  emisor: MensajeIa["emisor"];
  contenido: string;
  timestamp: Date;
}

export interface HistorialChatPublic {
  conversacion: { id: number; estado: string };
  cliente: { id: number; nombre: string };
  waMe: string | null;
  mensajes: MensajeChatPublic[];
}

/**
 * HU-53: historial unificado de conversación con el cliente, chat por simulador
 * (envío de mensaje manual del agente) y enlace wa.me. Reutiliza la
 * infraestructura del ítem 23 (ConversacionIa/MensajeIa, gateway, obtenerConversacion).
 */
@Injectable()
export class ConversacionChatService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(MensajeIa)
    private readonly mensajeRepo: Repository<MensajeIa>,
    private readonly notificacionesService: NotificacionesService,
    @Inject(WHATSAPP_GATEWAY)
    private readonly gateway: WhatsappGateway,
  ) {}

  async obtenerHistorial(
    carteraId: number,
    clienteId: number,
    requester: RequesterChatContext,
  ): Promise<HistorialChatPublic> {
    const { cliente, conversacion } = await this.acceder(carteraId, clienteId, requester);

    const mensajes = await this.mensajeRepo.find({
      where: { conversacion: { id: conversacion.id } },
      order: { timestamp: "ASC" },
    });

    return {
      conversacion: { id: conversacion.id, estado: conversacion.estado },
      cliente: { id: cliente.id, nombre: `${cliente.nombre} ${cliente.apellido}`.trim() },
      waMe: generarLinkWaMe(cliente.telefonoWhatsapp),
      mensajes: mensajes.map((m) => ({
        id: m.id,
        emisor: m.emisor,
        contenido: m.contenido,
        timestamp: m.timestamp,
      })),
    };
  }

  async enviarMensajeAgente(
    carteraId: number,
    clienteId: number,
    contenido: string,
    requester: RequesterChatContext,
  ): Promise<MensajeChatPublic> {
    const { conversacion } = await this.acceder(carteraId, clienteId, requester);

    const enviado = await this.gateway.enviarMensaje({
      conversacionId: conversacion.id,
      emisor: "agente",
      contenido,
    });

    return {
      id: (enviado as { id?: number })?.id ?? 0,
      emisor: "agente",
      contenido,
      timestamp: new Date(),
    };
  }

  private async acceder(
    carteraId: number,
    clienteId: number,
    requester: RequesterChatContext,
  ): Promise<{ cliente: Cliente; conversacion: ConversacionIa }> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const cliente = await this.clienteRepo.findOne({
      where: { id: clienteId, cartera: { id: carteraId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe en esta cartera");
    }

    const conversacion = await this.notificacionesService.obtenerConversacion(cliente);
    return { cliente, conversacion };
  }
}