import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateSocioDto } from "./dto/create-socio.dto";
import { SociosController } from "./socios.controller";
import { SociosService } from "./socios.service";

describe("SociosController", () => {
  let controller: SociosController;
  let service: SociosService;

  const mockService = {
    create: jest.fn(),
    update: jest.fn(),
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
        JwtAuthGuard,
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(SociosController);
    service = module.get(SociosService);
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
});
