import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ActualizarPerfilDto } from "./dto/actualizar-perfil.dto";
import { PerfilService } from "./perfil.service";

/**
 * `GET/PATCH /perfil`: lectura y auto-actualización del perfil del usuario
 * autenticado (admin, cobrador o socio). Solo `JwtAuthGuard` (revalida estado
 * activo); no requiere permiso porque opera sobre los datos propios.
 */
@Controller("perfil")
@UseGuards(JwtAuthGuard)
export class PerfilController {
  constructor(private readonly service: PerfilService) {}

  @Get()
  obtener(@Req() req: Request & { user: AuthTokenPayload }) {
    return this.service.obtener(req.user.rol, req.user.sub);
  }

  @Patch()
  actualizar(
    @Body() dto: ActualizarPerfilDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.service.actualizar(req.user.rol, req.user.sub, {
      nombre: dto.nombre,
      apellido: dto.apellido,
    });
  }
}
