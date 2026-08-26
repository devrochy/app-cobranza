import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CobrosSocioController } from "./cobros-socio.controller";
import { CobrosSocioService } from "./cobros-socio.service";
import { NotificacionesSocioService } from "./notificaciones-socio.service";

describe("CobrosSocioController", () => {
  let controller: CobrosSocioController;
  let service: CobrosSocioService;
  let notificaciones: NotificacionesSocioService;

  const mockService = {
    listar: jest.fn(),
    obtener: jest.fn(),
    registrarPago: jest.fn(),
    generarCobro: jest.fn(),
  };
  const mockNotificaciones = {
    confirmarPago: jest.fn().mockResolvedValue(undefined),
  };

  const req = {
    user: { sub: 7, rol: "admin" } as AuthTokenPayload,
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CobrosSocioController],
      providers: [
        { provide: CobrosSocioService, useValue: mockService },
        { provide: NotificacionesSocioService, useValue: mockNotificaciones },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CobrosSocioController);
    service = module.get(CobrosSocioService);
    notificaciones = module.get(NotificacionesSocioService);
  });

  it("listar delega en el servicio con los filtros", async () => {
    await controller.listar({ socioId: 1, periodo: "2026-08", estado: "pendiente" });
    expect(service.listar).toHaveBeenCalledWith({
      socioId: 1,
      periodo: "2026-08",
      estado: "pendiente",
    });
  });

  it("obtener delega en el servicio", async () => {
    await controller.obtener(9);
    expect(service.obtener).toHaveBeenCalledWith(9);
  });

  it("generar delega en el servicio", async () => {
    await controller.generar({ socioId: 1, periodo: "2026-08" });
    expect(service.generarCobro).toHaveBeenCalledWith(1, "2026-08");
  });

  it("pago registra el pago con el admin como actor y confirma por notificación", async () => {
    (service.registrarPago as jest.Mock).mockResolvedValue({ id: 3 });

    const res = await controller.pagar(
      3,
      { montoPagado: 500, metodoPago: "qr", fechaPago: "2026-08-12" },
      req,
    );

    expect(service.registrarPago).toHaveBeenCalledWith(3, {
      montoPagado: 500,
      metodoPago: "qr",
      fechaPago: "2026-08-12",
      registradoPor: 7,
    });
    expect(notificaciones.confirmarPago).toHaveBeenCalledWith(3, 500);
    expect(res).toEqual({ id: 3 });
  });
});