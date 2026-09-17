import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { PERMISO_REQUERIDO_KEY } from "../auth/permiso-requerido.decorator";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { MonitoreoIaService } from "./monitoreo-ia.service";

describe("DashboardController", () => {
  let controller: DashboardController;
  let dashboard: DashboardService;
  let monitoreo: MonitoreoIaService;

  const mockDashboard = { obtener: jest.fn(), series: jest.fn() };
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
        { provide: PermisosPropietarioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(DashboardController);
    dashboard = module.get(DashboardService);
    monitoreo = module.get(MonitoreoIaService);
  });

  it("dashboard delega en el servicio", async () => {
    await controller.dashboard(
      {} as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );
    expect(dashboard.obtener).toHaveBeenCalled();
  });

  it("pasa carteraId y propietarioId del query al servicio para rol admin", async () => {
    await controller.dashboard(
      { carteraId: 6, propietarioId: 3 } as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );

    expect(dashboard.obtener).toHaveBeenCalledWith(
      expect.any(Date),
      { carteraId: 6, propietarioId: 3 },
    );
  });

  it("pasa filtros vacíos cuando el query no trae nada (admin)", async () => {
    await controller.dashboard(
      {} as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );

    expect(dashboard.obtener).toHaveBeenCalledWith(expect.any(Date), {});
  });

  it("para rol propietario fuerza propietarioId = sub e ignora carteraId/propietarioId del query", async () => {
    await controller.dashboard(
      { carteraId: 6, propietarioId: 9 } as never,
      { user: { rol: "propietario", sub: 3 } } as never,
    );

    expect(dashboard.obtener).toHaveBeenCalledWith(expect.any(Date), {
      propietarioId: 3,
    });
  });

  it("exige ver_reportes para que un propietario pueda acceder a su dashboard", () => {
    const permiso = Reflect.getMetadata(
      PERMISO_REQUERIDO_KEY,
      DashboardController.prototype.dashboard,
    );

    expect(permiso).toBe("ver_reportes");
  });

  it("series delega con dias por defecto (14) para admin", async () => {
    await controller.series(
      {} as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );

    expect(dashboard.series).toHaveBeenCalledWith(expect.any(Date), {}, 14);
  });

  it("series pasa dias y filtros del query para admin", async () => {
    await controller.series(
      { carteraId: 6, propietarioId: 3, dias: 30 } as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );

    expect(dashboard.series).toHaveBeenCalledWith(expect.any(Date), {
      carteraId: 6,
      propietarioId: 3,
    }, 30);
  });

  it("series para rol propietario fuerza propietarioId = sub e ignora el query", async () => {
    await controller.series(
      { carteraId: 6, propietarioId: 9, dias: 7 } as never,
      { user: { rol: "propietario", sub: 3 } } as never,
    );

    expect(dashboard.series).toHaveBeenCalledWith(expect.any(Date), {
      propietarioId: 3,
    }, 7);
  });

  it("series exige ver_reportes", () => {
    const permiso = Reflect.getMetadata(
      PERMISO_REQUERIDO_KEY,
      DashboardController.prototype.series,
    );

    expect(permiso).toBe("ver_reportes");
  });

  it("monitoreo IA delega en el servicio", async () => {
    await controller.monitoreoIa();
    expect(monitoreo.obtener).toHaveBeenCalled();
  });
});