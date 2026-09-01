import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { AplicarEventosOfflineService } from "./aplicar-eventos-offline.service";
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
    private readonly aplicarEventosOfflineService: AplicarEventosOfflineService,
    private readonly snapshotDiaService: SnapshotDiaService,
  ) {}

  @Post("devices")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrar(@Body() dto: RegistrarDispositivoDto) {
    return this.devicesService.registrar(dto);
  }

  @Post("sync-offline/eventos")
  @UseGuards(DeviceApiKeyGuard)
  async sincronizar(
    @Body() dto: SincronizarEventosDto,
    @Req() req: RequestWithDevice,
  ) {
    const resultados = await this.sincronizacionOfflineService.ingestir(
      req.device!,
      dto.eventos,
    );
    // Aplica los eventos aceptados al dominio (Fase B: offline-first).
    await this.aplicarEventosOfflineService.aplicarPendientesDeDispositivo(
      req.device!,
    );
    return resultados;
  }

  @Get("sync-offline/dia")
  @UseGuards(DeviceApiKeyGuard)
  snapshotDia(@Req() req: RequestWithDevice) {
    return this.snapshotDiaService.obtenerSnapshot(req.device!);
  }
}