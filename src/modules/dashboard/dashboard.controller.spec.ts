import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { MonitoreoIaService } from "./monitoreo-ia.service";

describe("DashboardController", () => {
  let controller: DashboardController;
  let dashboard: DashboardService;
  let monitoreo: MonitoreoIaService;

  const mockDashboard = { obtener: jest.fn() };
  const mockMonitoreo = { obtener: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboard },
        { provide: MonitoreoIaService, useValue: mockMonitoreo },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(DashboardController);
    dashboard = module.get(DashboardService);
    monitoreo = module.get(MonitoreoIaService);
  });

  it("dashboard delega en el servicio", async () => {
    await controller.dashboard({} as never);
    expect(dashboard.obtener).toHaveBeenCalled();
  });

  it("pasa rutaId y socioId del query al servicio", async () => {
    await controller.dashboard({ rutaId: 6, socioId: 3 } as never);

    expect(dashboard.obtener).toHaveBeenCalledWith(
      expect.any(Date),
      { rutaId: 6, socioId: 3 },
    );
  });

  it("pasa filtros vacíos cuando el query no trae nada", async () => {
    await controller.dashboard({} as never);

    expect(dashboard.obtener).toHaveBeenCalledWith(expect.any(Date), {});
  });

  it("monitoreo IA delega en el servicio", async () => {
    await controller.monitoreoIa();
    expect(monitoreo.obtener).toHaveBeenCalled();
  });
});