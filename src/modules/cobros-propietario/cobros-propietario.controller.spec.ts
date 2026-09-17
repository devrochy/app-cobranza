import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { CobrosPropietarioController } from "./cobros-propietario.controller";
import { CobrosPropietarioService } from "./cobros-propietario.service";
import { NotificacionesPropietarioService } from "./notificaciones-propietario.service";

describe("CobrosPropietarioController", () => {
  let controller: CobrosPropietarioController;
  let service: CobrosPropietarioService;
  let notificaciones: NotificacionesPropietarioService;

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
      controllers: [CobrosPropietarioController],
      providers: [
        { provide: CobrosPropietarioService, useValue: mockService },
        { provide: NotificacionesPropietarioService, useValue: mockNotificaciones },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        { provide: PermisosPropietarioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CobrosPropietarioController);
    service = module.get(CobrosPropietarioService);
    notificaciones = module.get(NotificacionesPropietarioService);
  });

  it("listar delega en el servicio con los filtros", async () => {
    await controller.listar({ propietarioId: 1, periodo: "2026-08", estado: "pendiente" });
    expect(service.listar).toHaveBeenCalledWith({
      propietarioId: 1,
      periodo: "2026-08",
      estado: "pendiente",
    });
  });

  it("obtener delega en el servicio", async () => {
    await controller.obtener(9);
    expect(service.obtener).toHaveBeenCalledWith(9);
  });

  it("generar delega en el servicio", async () => {
    await controller.generar({ propietarioId: 1, periodo: "2026-08" });
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