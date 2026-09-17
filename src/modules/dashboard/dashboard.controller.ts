import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { AuthTokenPayload } from "../auth/auth.service";
import { DashboardService } from "./dashboard.service";
import { MonitoreoIaService } from "./monitoreo-ia.service";
import { ListarDashboardDto } from "./dto/listar-dashboard.dto";
import { ListarSeriesDto } from "./dto/listar-series.dto";

/**
 * Endpoints del panel admin (Épica 5). `GET /dashboard` exige `ver_reportes`:
 * el PermisoGuard deja pasar a admin siempre y a un propietario solo si tiene el
 * permiso (p. ej. juanita con toda la matriz). El handler fuerza `propietarioId = sub`
 * para rol propietario (ignora `carteraId` del query). `conversaciones-ia/panel` sigue
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
    const esPropietario = req.user.rol === "propietario";
    return this.dashboardService.obtener(new Date(), {
      carteraId: esPropietario ? undefined : dto.carteraId,
      propietarioId: esPropietario ? req.user.sub : dto.propietarioId,
    });
  }

  @Get("dashboard/series")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  series(
    @Query() dto: ListarSeriesDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const esPropietario = req.user.rol === "propietario";
    return this.dashboardService.series(
      new Date(),
      {
        carteraId: esPropietario ? undefined : dto.carteraId,
        propietarioId: esPropietario ? req.user.sub : dto.propietarioId,
      },
      dto.dias ?? 14,
    );
  }

  @Get("conversaciones-ia/panel")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  monitoreoIa() {
    return this.monitoreoIaService.obtener();
  }
}