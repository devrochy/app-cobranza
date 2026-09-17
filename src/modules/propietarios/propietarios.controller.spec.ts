import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { AuthTokenPayload } from "../auth/auth.service";
import { CreatePropietarioDto } from "./dto/create-propietario.dto";
import { ListarPropietariosDto } from "./dto/listar-propietarios.dto";
import { PermisosPropietarioService } from "./permisos-propietario.service";
import { PropietariosController } from "./propietarios.controller";
import { PropietariosService } from "./propietarios.service";

describe("PropietariosController", () => {
  let controller: PropietariosController;
  let service: PropietariosService;
  let permisosService: PermisosPropietarioService;

  const mockService = {
    create: jest.fn(),
    update: jest.fn(),
    setEstatus: jest.fn(),
    obtener: jest.fn(),
    listar: jest.fn(),
    actualizarConfiguracion: jest.fn(),
  };

  const mockPermisosService = {
    getMatriz: jest.fn(),
    setMatriz: jest.fn(),
  };

  const baseDto: CreatePropietarioDto = {
    usuario: "propietario1",
    password: "password-seguro",
    nombre: "Juan",
    apellido: "Pérez",
    correo: "juan@correo.com",
    telefono: "+59170000001",
    codigo: "SC001",
    moneda: "BOB",
    estatus: "activo",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropietariosController],
      providers: [
        { provide: PropietariosService, useValue: mockService },
        { provide: PermisosPropietarioService, useValue: mockPermisosService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(PropietariosController);
    service = module.get(PropietariosService);
    permisosService = module.get(PermisosPropietarioService);
  });

  it("delega en el servicio con el DTO y devuelve el propietario creado", async () => {
    const created = {
      id: 1,
      usuario: baseDto.usuario,
      nombre: baseDto.nombre,
      apellido: baseDto.apellido,
      correo: baseDto.correo,
      telefono: baseDto.telefono,
      codigo: baseDto.codigo,
      moneda: baseDto.moneda,
      estatus: baseDto.estatus,
      createdAt: new Date(),
    };
    (service.create as jest.Mock).mockResolvedValue(created);

    const result = await controller.create(baseDto);

    expect(service.create).toHaveBeenCalledWith(baseDto);
    expect(result.id).toBe(1);
    expect(result.codigo).toBe("SC001");
  });

  it("delega en el servicio con id y DTO al actualizar", async () => {
    const updated = {
      id: 1,
      usuario: "propietario1",
      nombre: "Juan Carlos",
      apellido: "Pérez",
      correo: "juan@correo.com",
      telefono: "+59170000001",
      codigo: "SC001",
      moneda: "BOB",
      estatus: "activo",
      createdAt: new Date(),
    };
    (service.update as jest.Mock).mockResolvedValue(updated);

    const result = await controller.update(1, { nombre: "Juan Carlos" });

    expect(service.update).toHaveBeenCalledWith(1, { nombre: "Juan Carlos" });
    expect(result.nombre).toBe("Juan Carlos");
  });

  it("delega en el servicio al cambiar el estatus", async () => {
    (service.setEstatus as jest.Mock).mockResolvedValue({ id: 1, estatus: "bloqueado" });

    const result = await controller.setEstatus(1, { estatus: "bloqueado" });

    expect(service.setEstatus).toHaveBeenCalledWith(1, "bloqueado");
    expect(result.estatus).toBe("bloqueado");
  });

  it("delega en el servicio de permisos al consultar la matriz", async () => {
    (permisosService.getMatriz as jest.Mock).mockResolvedValue([]);

    await controller.getPermisos(1);

    expect(permisosService.getMatriz).toHaveBeenCalledWith(1);
  });

  it("delega en el servicio de permisos al configurar la matriz", async () => {
    const matriz = { ver_reportes: true };
    (permisosService.setMatriz as jest.Mock).mockResolvedValue([]);

    await controller.setPermisos(1, { matriz });

    expect(permisosService.setMatriz).toHaveBeenCalledWith(1, matriz);
  });

  it("delega en el servicio al obtener un propietario por id", async () => {
    (service.obtener as jest.Mock).mockResolvedValue({ id: 1 });

    await controller.getById(1);

    expect(service.obtener).toHaveBeenCalledWith(1);
  });

  it("delega en el servicio al listar propietarios con los filtros del query y el contexto", async () => {
    (service.listar as jest.Mock).mockResolvedValue([{ id: 1 }]);
    const query: ListarPropietariosDto = { busqueda: "juan", estatus: "activo" };
    const req = { user: { sub: 1, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listar(query, req);

    expect(service.listar).toHaveBeenCalledWith(query, { rol: "propietario", sub: 1 });
  });

  it("delega en el servicio al actualizar la configuración del propietario", async () => {
    (service.actualizarConfiguracion as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { nombreOficinaCobro: "Mi Oficina", diasToleranciaCobro: 3 };

    await controller.actualizarConfiguracion(1, dto, req);

    expect(service.actualizarConfiguracion).toHaveBeenCalledWith(
      1,
      dto,
      { rol: "propietario", sub: 1 },
    );
  });
});
