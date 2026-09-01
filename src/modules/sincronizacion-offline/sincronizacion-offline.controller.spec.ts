import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { DeviceApiKeyGuard } from "./device-api-key.guard";
import { AplicarEventosOfflineService } from "./aplicar-eventos-offline.service";
import { DevicesService } from "./devices.service";
import { SincronizacionOfflineService } from "./sincronizacion-offline.service";
import { SincronizacionOfflineController } from "./sincronizacion-offline.controller";
import { SnapshotDiaService } from "./snapshot-dia.service";

describe("SincronizacionOfflineController", () => {
  let controller: SincronizacionOfflineController;
  let devices: DevicesService;
  let syncService: SincronizacionOfflineService;
  let snapshot: SnapshotDiaService;

  const mockDevices = { registrar: jest.fn(), autenticar: jest.fn() };
  const mockSync = { ingestir: jest.fn() };
  const mockAplicar = { aplicarPendientesDeDispositivo: jest.fn() };
  const mockSnapshot = { obtenerSnapshot: jest.fn() };

  const deviceReq = { device: { id: 3, rutaId: 5 } } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SincronizacionOfflineController],
      providers: [
        { provide: DevicesService, useValue: mockDevices },
        { provide: SincronizacionOfflineService, useValue: mockSync },
        { provide: AplicarEventosOfflineService, useValue: mockAplicar },
        { provide: SnapshotDiaService, useValue: mockSnapshot },
        DeviceApiKeyGuard,
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(SincronizacionOfflineController);
    devices = module.get(DevicesService);
    syncService = module.get(SincronizacionOfflineService);
    snapshot = module.get(SnapshotDiaService);
  });

  it("registrar dispositivo delega en el servicio", async () => {
    await controller.registrar({ rutaId: 5 });
    expect(devices.registrar).toHaveBeenCalledWith({ rutaId: 5 });
  });

  it("sincronizar eventos usa el dispositivo del guard y aplica los aceptados", async () => {
    await controller.sincronizar(
      { eventos: [{ eventoIdCliente: "11111111-1111-4111-8111-111111111111", tipoEvento: "visita", payload: {} }] },
      deviceReq,
    );
    expect(syncService.ingestir).toHaveBeenCalledWith(
      { id: 3, rutaId: 5 },
      [{ eventoIdCliente: "11111111-1111-4111-8111-111111111111", tipoEvento: "visita", payload: {} }],
    );
    expect(mockAplicar.aplicarPendientesDeDispositivo).toHaveBeenCalledWith({ id: 3, rutaId: 5 });
  });

  it("obtener snapshot del día delega con el dispositivo", async () => {
    await controller.snapshotDia(deviceReq);
    expect(snapshot.obtenerSnapshot).toHaveBeenCalledWith({ id: 3, rutaId: 5 });
  });
});