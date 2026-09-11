import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { AplicarEventosOfflineService } from "./aplicar-eventos-offline.service";
import { DeviceApiKeyGuard, RequestWithDevice } from "./device-api-key.guard";
import { DevicesService } from "./devices.service";
import { RegistrarDispositivoDto } from "./dto/registrar-dispositivo.dto";
import { IntentosAccesoService } from "./intentos-acceso.service";
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
    private readonly intentosAccesoService: IntentosAccesoService,
  ) {}

  @Post("devices")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrar(@Body() dto: RegistrarDispositivoDto) {
    return this.devicesService.registrar(dto);
  }

  @Get("devices")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarDispositivos() {
    return this.devicesService.listar();
  }

  @Patch("devices/:id/revocar")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  revocarDispositivo(@Param("id", ParseIntPipe) id: number) {
    return this.devicesService.revocar(id);
  }

  @Get("intentos-acceso")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarIntentosAcceso() {
    return this.intentosAccesoService.listar();
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
  snapshotDia(
    @Req() req: RequestWithDevice,
    @Query("rutaId", ParseIntPipe) rutaId: number,
  ) {
    return this.snapshotDiaService.obtenerSnapshot(req.device!, rutaId);
  }
}