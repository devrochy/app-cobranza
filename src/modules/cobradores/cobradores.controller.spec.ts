import { ConfigService } from "@nestjs/config";
import { ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CobradoresPermisosService } from "./cobradores-permisos.service";
import { CreateCobradorDto } from "./dto/create-cobrador.dto";
import { CobradoresController } from "./cobradores.controller";
import { CobradoresService } from "./cobradores.service";

describe("CobradoresController", () => {
  let controller: CobradoresController;
  let service: CobradoresService;
  let permisosService: CobradoresPermisosService;

  const mockService = {
    create: jest.fn(),
    listar: jest.fn(),
    update: jest.fn(),
    setEstatus: jest.fn(),
  };

  const mockPermisosService = {
    getMatriz: jest.fn(),
    setMatriz: jest.fn(),
    assertOwnedBySocio: jest.fn(),
  };

  const baseDto: CreateCobradorDto = {
    socioId: 1,
    usuario: "cobrador1",
    password: "password-seguro",
    nombre: "Carlos",
    apellido: "López",
    correo: "carlos@correo.com",
    telefono: "+59171111111",
    codigo: "CB001",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CobradoresController],
      providers: [
        { provide: CobradoresService, useValue: mockService },
        { provide: CobradoresPermisosService, useValue: mockPermisosService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CobradoresController);
    service = module.get(CobradoresService);
    permisosService = module.get(CobradoresPermisosService);
  });

  it("delega en el servicio con el DTO y devuelve el cobrador creado", async () => {
    const created = {
      id: 1,
      socioId: 1,
      usuario: baseDto.usuario,
      nombre: baseDto.nombre,
      apellido: baseDto.apellido,
      correo: baseDto.correo,
      telefono: baseDto.telefono,
      codigo: baseDto.codigo,
      estatus: "activo",
      createdAt: new Date(),
    };
    (service.create as jest.Mock).mockResolvedValue(created);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    const result = await controller.create(baseDto, req);

    expect(service.create).toHaveBeenCalledWith(baseDto);
    expect(result.id).toBe(1);
    expect(result.socioId).toBe(1);
  });

  it("un socio solo puede crear cobradores bajo su propio socioId", async () => {
    (service.create as jest.Mock).mockResolvedValue({});
    const req = { user: { sub: 10, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.create({ ...baseDto, socioId: 10 }, req);

    expect(service.create).toHaveBeenCalledWith({ ...baseDto, socioId: 10 });
  });

  it("un socio no puede crear cobradores bajo otro socioId -> 403", async () => {
    const req = { user: { sub: 10, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    expect(() => controller.create({ ...baseDto, socioId: 99 }, req)).toThrow(
      ForbiddenException,
    );
  });

  it("delega en el servicio con id y DTO al actualizar", async () => {
    const updated = {
      id: 1,
      socioId: 1,
      usuario: "cobrador1",
      nombre: "Carlos Eduardo",
      apellido: "López",
      correo: "carlos@correo.com",
      telefono: "+59171111111",
      codigo: "CB001",
      estatus: "activo",
      createdAt: new Date(),
    };
    (service.update as jest.Mock).mockResolvedValue(updated);

    const result = await controller.update(1, { nombre: "Carlos Eduardo" });

    expect(service.update).toHaveBeenCalledWith(1, { nombre: "Carlos Eduardo" });
    expect(result.nombre).toBe("Carlos Eduardo");
  });

  it("delega en el servicio al cambiar el estatus", async () => {
    (service.setEstatus as jest.Mock).mockResolvedValue({ id: 1, estatus: "bloqueado" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    const result = await controller.setEstatus(1, { estatus: "bloqueado" }, req);

    expect(service.setEstatus).toHaveBeenCalledWith(1, "bloqueado");
    expect(result.estatus).toBe("bloqueado");
  });

  it("un socio solo puede bloquear cobradores que le pertenecen", async () => {
    (service.setEstatus as jest.Mock).mockResolvedValue({ id: 1, estatus: "bloqueado" });
    const req = { user: { sub: 10, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.setEstatus(1, { estatus: "bloqueado" }, req);

    expect(permisosService.assertOwnedBySocio).toHaveBeenCalledWith(1, 10);
    expect(service.setEstatus).toHaveBeenCalledWith(1, "bloqueado");
  });

  it("un admin lista todos los cobradores", async () => {
    (service.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listar(req);

    expect(service.listar).toHaveBeenCalledWith(undefined);
  });

  it("un socio lista solo sus cobradores", async () => {
    (service.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 10, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listar(req);

    expect(service.listar).toHaveBeenCalledWith(10);
  });

  it("consulta la matriz de permisos de un cobrador", async () => {
    (permisosService.getMatriz as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.getPermisos(1, req);

    expect(permisosService.getMatriz).toHaveBeenCalledWith(1);
  });

  it("un socio con editar_permisos verifica ownership antes de consultar la matriz", async () => {
    (permisosService.getMatriz as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 10, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.getPermisos(1, req);

    expect(permisosService.assertOwnedBySocio).toHaveBeenCalledWith(1, 10);
    expect(permisosService.getMatriz).toHaveBeenCalledWith(1);
  });

  it("configura la matriz de permisos de un cobrador", async () => {
    (permisosService.setMatriz as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const matriz = { registrar_pago: true };

    await controller.setPermisos(1, { matriz }, req);

    expect(permisosService.setMatriz).toHaveBeenCalledWith(1, matriz);
  });
});
