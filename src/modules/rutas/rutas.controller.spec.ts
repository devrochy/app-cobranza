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
import { InyeccionesService } from "./inyecciones.service";
import { RutaConfigService } from "./ruta-config.service";
import { RutasController } from "./rutas.controller";
import { RutasService } from "./rutas.service";

describe("RutasController", () => {
  let controller: RutasController;
  let service: RutasService;
  let rutaConfigService: RutaConfigService;
  let inyeccionesService: InyeccionesService;

  const mockService = {
    create: jest.fn(),
    setEstatus: jest.fn(),
    reasignarCobrador: jest.fn(),
    actualizarInformacion: jest.fn(),
    actualizarConfiguracion: jest.fn(),
  };

  const mockRutaConfigService = {
    getMatriz: jest.fn(),
    setMatriz: jest.fn(),
  };

  const mockInyeccionesService = {
    crear: jest.fn(),
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
        { provide: RutaConfigService, useValue: mockRutaConfigService },
        { provide: InyeccionesService, useValue: mockInyeccionesService },
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
    rutaConfigService = module.get(RutaConfigService);
    inyeccionesService = module.get(InyeccionesService);
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

  it("delega al editar la configuración de la ruta", async () => {
    (service.actualizarConfiguracion as jest.Mock).mockResolvedValue({ id: 1, tipoInteres: 25 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.actualizarConfiguracion(1, { tipoInteres: 25 }, req);

    expect(service.actualizarConfiguracion).toHaveBeenCalledWith(1, { tipoInteres: 25 }, { rol: "admin", sub: 1 });
  });

  it("delega al consultar la matriz ruta_config", async () => {
    (rutaConfigService.getMatriz as jest.Mock).mockResolvedValue({});
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.getRutaConfig(1, req);

    expect(rutaConfigService.getMatriz).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al configurar la matriz ruta_config", async () => {
    (rutaConfigService.setMatriz as jest.Mock).mockResolvedValue({});
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { mostrarCaja: true };

    await controller.setRutaConfig(1, dto, req);

    expect(rutaConfigService.setMatriz).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });

  it("delega al registrar una inyección", async () => {
    (inyeccionesService.crear as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { valor: 1500, comentario: "Aporte" };

    await controller.crearInyeccion(1, dto, req);

    expect(inyeccionesService.crear).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });
});
