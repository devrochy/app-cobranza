import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { IsInt, IsNotEmpty, IsString } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";

export class RecibirMensajeDto {
  @IsInt({ message: "conversacionId debe ser un número" })
  conversacionId!: number;

  @IsString()
  @IsNotEmpty({ message: "contenido es obligatorio" })
  contenido!: string;
}

/**
 * Webhook simulado de recepción de mensajes de WhatsApp (Fase 1, PRD 6.1).
 * Recibe un mensaje entrante "como si viniera del cliente" y lo delega al
 * gateway (la implementación simulada lo persiste en `mensajes_ia`).
 * Protegido con JWT (no expuesto públicamente); en Fase 2 se sustituye por el
 * webhook real de la Cloud API.
 */
@Controller("whatsapp/simulado")
@UseGuards(JwtAuthGuard)
export class WhatsappSimuladoController {
  constructor(@Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsappGateway) {}

  @Post("recibir")
  async recibir(@Body() dto: RecibirMensajeDto) {
    return this.gateway.recibirMensaje({
      conversacionId: dto.conversacionId,
      emisor: "cliente",
      contenido: dto.contenido,
    });
  }
}