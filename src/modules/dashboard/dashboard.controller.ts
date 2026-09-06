import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { AuthTokenPayload } from "../auth/auth.service";
import { DashboardService } from "./dashboard.service";
import { MonitoreoIaService } from "./monitoreo-ia.service";
import { ListarDashboardDto } from "./dto/listar-dashboard.dto";

/**
 * Endpoints del panel admin (Épica 5). Sin @PermisoRequerido, el PermisoGuard
 * deja pasar solo a rol admin; `dashboard` admite además rol socio con su
 * propio dashboard (socioId = sub, se ignora rutaId del query).
 */
@Controller()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly monitoreoIaService: MonitoreoIaService,
  ) {}

  @Get("dashboard")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  dashboard(
    @Query() dto: ListarDashboardDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const esSocio = req.user.rol === "socio";
    return this.dashboardService.obtener(new Date(), {
      rutaId: esSocio ? undefined : dto.rutaId,
      socioId: esSocio ? req.user.sub : dto.socioId,
    });
  }

  @Get("conversaciones-ia/panel")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  monitoreoIa() {
    return this.monitoreoIaService.obtener();
  }
}