import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { AuthTokenPayload } from "../auth/auth.service";
import { DashboardService } from "./dashboard.service";
import { MonitoreoIaService } from "./monitoreo-ia.service";
import { ListarDashboardDto } from "./dto/listar-dashboard.dto";

/**
 * Endpoints del panel admin (Épica 5). `GET /dashboard` exige `ver_reportes`:
 * el PermisoGuard deja pasar a admin siempre y a un socio solo si tiene el
 * permiso (p. ej. juanita con toda la matriz). El handler fuerza `socioId = sub`
 * para rol socio (ignora `rutaId` del query). `conversaciones-ia/panel` sigue
 * admin-only (sin @PermisoRequerido).
 */
@Controller()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly monitoreoIaService: MonitoreoIaService,
  ) {}

  @Get("dashboard")
  @PermisoRequerido("ver_reportes")
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