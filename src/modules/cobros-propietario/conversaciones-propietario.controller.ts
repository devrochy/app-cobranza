import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { ConversacionPropietarioChatService } from "./conversacion-propietario-chat.service";
import { EnviarMensajePropietarioDto } from "./dto/enviar-mensaje-propietario.dto";

/**
 * Conversaciones Admin↔Propietario (HU-63). El listado es admin-only (PermisoGuard sin
 * @PermisoRequerido); el historial y el envío usan JwtAuthGuard y la validación
 * de self-service (admin → cualquiera, propietario → solo su propia) se hace en el
 * servicio (decisión: sin permiso adicional para el propietario).
 */
@Controller("conversaciones-propietario")
export class ConversacionesPropietarioController {
  constructor(
    private readonly conversacionPropietarioChatService: ConversacionPropietarioChatService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listar() {
    return this.conversacionPropietarioChatService.listarConversaciones();
  }

  @Get(":propietarioId")
  @UseGuards(JwtAuthGuard)
  obtener(
    @Param("propietarioId", ParseIntPipe) propietarioId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.conversacionPropietarioChatService.obtenerHistorial(propietarioId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":propietarioId/mensajes")
  @UseGuards(JwtAuthGuard)
  enviar(
    @Param("propietarioId", ParseIntPipe) propietarioId: number,
    @Body() dto: EnviarMensajePropietarioDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.conversacionPropietarioChatService.enviarMensaje(propietarioId, dto.contenido, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }
}