import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { DashboardService } from "./dashboard.service";
import { MonitoreoIaService } from "./monitoreo-ia.service";
import { ListarDashboardDto } from "./dto/listar-dashboard.dto";

/**
 * Endpoints del panel admin (Épica 5). Admin-only: sin @PermisoRequerido, el
 * PermisoGuard deja pasar solo a rol admin.
 */
@Controller()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly monitoreoIaService: MonitoreoIaService,
  ) {}

  @Get("dashboard")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  dashboard(@Query() dto: ListarDashboardDto) {
    return this.dashboardService.obtener(new Date(), {
      rutaId: dto.rutaId,
      socioId: dto.socioId,
    });
  }

  @Get("conversaciones-ia/panel")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  monitoreoIa() {
    return this.monitoreoIaService.obtener();
  }
}