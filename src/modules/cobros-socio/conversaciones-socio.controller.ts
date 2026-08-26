import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { ConversacionSocioChatService } from "./conversacion-socio-chat.service";
import { EnviarMensajeSocioDto } from "./dto/enviar-mensaje-socio.dto";

/**
 * Conversaciones Admin↔Socio (HU-63). El listado es admin-only (PermisoGuard sin
 * @PermisoRequerido); el historial y el envío usan JwtAuthGuard y la validación
 * de self-service (admin → cualquiera, socio → solo su propia) se hace en el
 * servicio (decisión: sin permiso adicional para el socio).
 */
@Controller("conversaciones-socio")
export class ConversacionesSocioController {
  constructor(
    private readonly conversacionSocioChatService: ConversacionSocioChatService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listar() {
    return this.conversacionSocioChatService.listarConversaciones();
  }

  @Get(":socioId")
  @UseGuards(JwtAuthGuard)
  obtener(
    @Param("socioId", ParseIntPipe) socioId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.conversacionSocioChatService.obtenerHistorial(socioId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":socioId/mensajes")
  @UseGuards(JwtAuthGuard)
  enviar(
    @Param("socioId", ParseIntPipe) socioId: number,
    @Body() dto: EnviarMensajeSocioDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.conversacionSocioChatService.enviarMensaje(socioId, dto.contenido, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }
}