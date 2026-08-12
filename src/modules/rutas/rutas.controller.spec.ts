import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CreateRutaDto } from "./dto/create-ruta.dto";
import { RutasController } from "./rutas.controller";
import { RutasService } from "./rutas.service";

describe("RutasController", () => {
  let controller: RutasController;
  let service: RutasService;

  const mockService = {
    create: jest.fn(),
    setEstatus: jest.fn(),
    reasignarCobrador: jest.fn(),
    actualizarInformacion: jest.fn(),
  };

  const baseDto: CreateRutaDto = {
    nombre: "Ruta Centro",
    descripcion: "Zona céntrica",
    socioId: 1,
    cobradorId: 1,
    tipoInteres: 20,
    numCuotas: 8,
    moneda: "BOB",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RutasController],
      providers: [
        { provide: RutasService, useValue: mockService },
        JwtAuthGuard,
        PermisoGuard,
        Reflector,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(RutasController);
    service = module.get(RutasService);
  });

  it("delega en el servicio con el DTO y el contexto del token", async () => {
    (service.create as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 10, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.create(baseDto, req);

    expect(service.create).toHaveBeenCalledWith(baseDto, { rol: "socio", sub: 10 });
  });

  it("delega al cambiar el estatus de la ruta", async () => {
    (service.setEstatus as jest.Mock).mockResolvedValue({ id: 1, estatus: "activo" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.setEstatus(1, { estatus: "activo" }, req);

    expect(service.setEstatus).toHaveBeenCalledWith(1, "activo", { rol: "admin", sub: 1 });
  });

  it("delega al reasignar el cobrador de la ruta", async () => {
    (service.reasignarCobrador as jest.Mock).mockResolvedValue({ id: 1, cobradorId: 2 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.reasignarCobrador(1, { cobradorId: 2 }, req);

    expect(service.reasignarCobrador).toHaveBeenCalledWith(1, 2, { rol: "admin", sub: 1 });
  });

  it("delega al editar la información de la ruta", async () => {
    (service.actualizarInformacion as jest.Mock).mockResolvedValue({ id: 1, nombre: "Ruta Norte" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.actualizarInformacion(1, { nombre: "Ruta Norte" }, req);

    expect(service.actualizarInformacion).toHaveBeenCalledWith(1, { nombre: "Ruta Norte" }, { rol: "admin", sub: 1 });
  });
});
