import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MensajeIa } from "./mensaje-ia.entity";
import { WhatsappGateway, WhatsappMensaje } from "./whatsapp-gateway.interface";

/**
 * Implementación simulada del canal de WhatsApp (Fase 1, PRD 6.1): en lugar de
 * contactar la API real de Meta, persiste cada mensaje en `mensajes_ia`.
 * En Fase 2 se sustituye por la implementación real vía configuración.
 */
@Injectable()
export class WhatsappSimuladoGateway implements WhatsappGateway {
  constructor(
    @InjectRepository(MensajeIa)
    private readonly mensajeRepo: Repository<MensajeIa>,
  ) {}

  async enviarMensaje(mensaje: WhatsappMensaje): Promise<MensajeIa> {
    return this.persistir(mensaje);
  }

  async recibirMensaje(mensaje: WhatsappMensaje): Promise<MensajeIa> {
    return this.persistir(mensaje);
  }

  private async persistir(mensaje: WhatsappMensaje): Promise<MensajeIa> {
    const fila = this.mensajeRepo.create({
      conversacion: { id: mensaje.conversacionId } as MensajeIa["conversacion"],
      conversacionId: mensaje.conversacionId,
      emisor: mensaje.emisor,
      contenido: mensaje.contenido,
      intencionDetectada: null,
      modeloUsado: null,
    });
    return this.mensajeRepo.save(fila);
  }
}