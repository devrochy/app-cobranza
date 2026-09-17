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
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { GestoresPermisosService } from "./gestores-permisos.service";
import { CreateGestorDto } from "./dto/create-gestor.dto";
import { GestoresController } from "./gestores.controller";
import { GestoresService } from "./gestores.service";

describe("GestoresController", () => {
  let controller: GestoresController;
  let service: GestoresService;
  let permisosService: GestoresPermisosService;

  const mockService = {
    create: jest.fn(),
    listar: jest.fn(),
    update: jest.fn(),
    setEstatus: jest.fn(),
  };

  const mockPermisosService = {
    getMatriz: jest.fn(),
    setMatriz: jest.fn(),
    assertOwnedByPropietario: jest.fn(),
  };

  const baseDto: CreateGestorDto = {
    propietarioId: 1,
    usuario: "gestor1",
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
      controllers: [GestoresController],
      providers: [
        { provide: GestoresService, useValue: mockService },
        { provide: GestoresPermisosService, useValue: mockPermisosService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosPropietarioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(GestoresController);
    service = module.get(GestoresService);
    permisosService = module.get(GestoresPermisosService);
  });

  it("delega en el servicio con el DTO y devuelve el gestor creado", async () => {
    const created = {
      id: 1,
      propietarioId: 1,
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
    expect(result.propietarioId).toBe(1);
  });

  it("un propietario solo puede crear gestores bajo su propio propietarioId", async () => {
    (service.create as jest.Mock).mockResolvedValue({});
    const req = { user: { sub: 10, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.create({ ...baseDto, propietarioId: 10 }, req);

    expect(service.create).toHaveBeenCalledWith({ ...baseDto, propietarioId: 10 });
  });

  it("un propietario no puede crear gestores bajo otro propietarioId -> 403", async () => {
    const req = { user: { sub: 10, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    expect(() => controller.create({ ...baseDto, propietarioId: 99 }, req)).toThrow(
      ForbiddenException,
    );
  });

  it("delega en el servicio con id y DTO al actualizar", async () => {
    const updated = {
      id: 1,
      propietarioId: 1,
      usuario: "gestor1",
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

  it("un propietario solo puede bloquear gestores que le pertenecen", async () => {
    (service.setEstatus as jest.Mock).mockResolvedValue({ id: 1, estatus: "bloqueado" });
    const req = { user: { sub: 10, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.setEstatus(1, { estatus: "bloqueado" }, req);

    expect(permisosService.assertOwnedByPropietario).toHaveBeenCalledWith(1, 10);
    expect(service.setEstatus).toHaveBeenCalledWith(1, "bloqueado");
  });

  it("un admin lista todos los gestores", async () => {
    (service.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listar(req);

    expect(service.listar).toHaveBeenCalledWith(undefined);
  });

  it("un propietario lista solo sus gestores", async () => {
    (service.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 10, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listar(req);

    expect(service.listar).toHaveBeenCalledWith(10);
  });

  it("consulta la matriz de permisos de un gestor", async () => {
    (permisosService.getMatriz as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.getPermisos(1, req);

    expect(permisosService.getMatriz).toHaveBeenCalledWith(1);
  });

  it("un propietario con editar_permisos verifica ownership antes de consultar la matriz", async () => {
    (permisosService.getMatriz as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 10, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.getPermisos(1, req);

    expect(permisosService.assertOwnedByPropietario).toHaveBeenCalledWith(1, 10);
    expect(permisosService.getMatriz).toHaveBeenCalledWith(1);
  });

  it("configura la matriz de permisos de un gestor", async () => {
    (permisosService.setMatriz as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const matriz = { registrar_pago: true };

    await controller.setPermisos(1, { matriz }, req);

    expect(permisosService.setMatriz).toHaveBeenCalledWith(1, matriz);
  });
});
