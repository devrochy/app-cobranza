import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";
import { AsistenteIaService } from "./asistente-ia.service";

export class RecibirMensajeDto {
  @IsInt({ message: "conversacionId debe ser un número" })
  conversacionId!: number;

  @IsOptional()
  @IsString()
  telefono?: string | null;

  @IsString()
  @IsNotEmpty({ message: "contenido es obligatorio" })
  contenido!: string;
}

/**
 * Webhook simulado de recepción de mensajes de WhatsApp (Fase 1, PRD 6.1).
 * Recibe un mensaje entrante "como si viniera del cliente", lo persiste (emisor
 * cliente) y delega al asistente conversacional para responder (HU-27). En Fase
 * 2 se sustituye por el webhook real de la Cloud API.
 */
@Controller("whatsapp/simulado")
@UseGuards(JwtAuthGuard)
export class WhatsappSimuladoController {
  constructor(
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsappGateway,
    private readonly asistenteIaService: AsistenteIaService,
  ) {}

  @Post("recibir")
  async recibir(@Body() dto: RecibirMensajeDto) {
    const recibido = await this.gateway.recibirMensaje({
      conversacionId: dto.conversacionId,
      emisor: "cliente",
      contenido: dto.contenido,
      telefono: dto.telefono,
    });

    // HU-27/HU-28: respuesta automática del asistente a la solicitud del cliente.
    // No bloqueante: un fallo al responder no debe romper la recepción del mensaje.
    try {
      await this.asistenteIaService.procesarMensaje({
        conversacionId: dto.conversacionId,
        telefono: dto.telefono,
        contenido: dto.contenido,
      });
    } catch {
      // se omite: la recepción ya quedó registrada
    }

    return recibido;
  }
}
