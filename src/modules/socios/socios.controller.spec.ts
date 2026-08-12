import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { CreateSocioDto } from "./dto/create-socio.dto";
import { PermisosSocioService } from "./permisos-socio.service";
import { SociosController } from "./socios.controller";
import { SociosService } from "./socios.service";

describe("SociosController", () => {
  let controller: SociosController;
  let service: SociosService;
  let permisosService: PermisosSocioService;

  const mockService = {
    create: jest.fn(),
    update: jest.fn(),
    setEstatus: jest.fn(),
  };

  const mockPermisosService = {
    getMatriz: jest.fn(),
    setMatriz: jest.fn(),
  };

  const baseDto: CreateSocioDto = {
    usuario: "socio1",
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
      controllers: [SociosController],
      providers: [
        { provide: SociosService, useValue: mockService },
        { provide: PermisosSocioService, useValue: mockPermisosService },
        JwtAuthGuard,
        PermisoGuard,
        Reflector,
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(SociosController);
    service = module.get(SociosService);
    permisosService = module.get(PermisosSocioService);
  });

  it("delega en el servicio con el DTO y devuelve el socio creado", async () => {
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
      usuario: "socio1",
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
});
