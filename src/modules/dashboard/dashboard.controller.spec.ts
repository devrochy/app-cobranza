import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
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
    await controller.dashboard(
      {} as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );
    expect(dashboard.obtener).toHaveBeenCalled();
  });

  it("pasa rutaId y socioId del query al servicio para rol admin", async () => {
    await controller.dashboard(
      { rutaId: 6, socioId: 3 } as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );

    expect(dashboard.obtener).toHaveBeenCalledWith(
      expect.any(Date),
      { rutaId: 6, socioId: 3 },
    );
  });

  it("pasa filtros vacíos cuando el query no trae nada (admin)", async () => {
    await controller.dashboard(
      {} as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );

    expect(dashboard.obtener).toHaveBeenCalledWith(expect.any(Date), {});
  });

  it("para rol socio fuerza socioId = sub e ignora rutaId/socioId del query", async () => {
    await controller.dashboard(
      { rutaId: 6, socioId: 9 } as never,
      { user: { rol: "socio", sub: 3 } } as never,
    );

    expect(dashboard.obtener).toHaveBeenCalledWith(expect.any(Date), {
      socioId: 3,
    });
  });

  it("exige ver_reportes para que un socio pueda acceder a su dashboard", () => {
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
      { rutaId: 6, socioId: 3, dias: 30 } as never,
      { user: { rol: "admin", sub: 1 } } as never,
    );

    expect(dashboard.series).toHaveBeenCalledWith(expect.any(Date), {
      rutaId: 6,
      socioId: 3,
    }, 30);
  });

  it("series para rol socio fuerza socioId = sub e ignora el query", async () => {
    await controller.series(
      { rutaId: 6, socioId: 9, dias: 7 } as never,
      { user: { rol: "socio", sub: 3 } } as never,
    );

    expect(dashboard.series).toHaveBeenCalledWith(expect.any(Date), {
      socioId: 3,
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