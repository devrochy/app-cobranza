import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { LiquidacionesService } from "./liquidaciones.service";

@Controller("reportes")
export class ReportesGlobalController {
  constructor(private readonly liquidacionesService: LiquidacionesService) {}

  @Get("liquidaciones")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarLiquidaciones(@Req() req: Request & { user: AuthTokenPayload }) {
    return this.liquidacionesService.listarGlobal({
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }
}