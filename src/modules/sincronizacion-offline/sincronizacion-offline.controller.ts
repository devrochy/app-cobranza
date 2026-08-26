import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { DeviceApiKeyGuard, RequestWithDevice } from "./device-api-key.guard";
import { DevicesService } from "./devices.service";
import { RegistrarDispositivoDto } from "./dto/registrar-dispositivo.dto";
import { SincronizarEventosDto } from "./dto/sincronizar-eventos.dto";
import { SincronizacionOfflineService } from "./sincronizacion-offline.service";
import { SnapshotDiaService } from "./snapshot-dia.service";

/**
 * API de sincronización offline (HU-64). El registro de dispositivos es
 * admin-only (JwtAuthGuard + PermisoGuard sin @PermisoRequerido); la ingestión
 * de eventos y el snapshot del día se autentican por API key de dispositivo.
 */
@Controller()
export class SincronizacionOfflineController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly sincronizacionOfflineService: SincronizacionOfflineService,
    private readonly snapshotDiaService: SnapshotDiaService,
  ) {}

  @Post("devices")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrar(@Body() dto: RegistrarDispositivoDto) {
    return this.devicesService.registrar(dto);
  }

  @Post("sync-offline/eventos")
  @UseGuards(DeviceApiKeyGuard)
  sincronizar(@Body() dto: SincronizarEventosDto, @Req() req: RequestWithDevice) {
    return this.sincronizacionOfflineService.ingestir(req.device!, dto.eventos);
  }

  @Get("sync-offline/dia")
  @UseGuards(DeviceApiKeyGuard)
  snapshotDia(@Req() req: RequestWithDevice) {
    return this.snapshotDiaService.obtenerSnapshot(req.device!);
  }
}