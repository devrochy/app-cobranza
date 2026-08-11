import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateCobradorDto } from "./dto/create-cobrador.dto";
import { CobradoresController } from "./cobradores.controller";
import { CobradoresService } from "./cobradores.service";

describe("CobradoresController", () => {
  let controller: CobradoresController;
  let service: CobradoresService;

  const mockService = {
    create: jest.fn(),
    update: jest.fn(),
    setEstatus: jest.fn(),
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
        JwtAuthGuard,
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CobradoresController);
    service = module.get(CobradoresService);
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

    const result = await controller.create(baseDto);

    expect(service.create).toHaveBeenCalledWith(baseDto);
    expect(result.id).toBe(1);
    expect(result.socioId).toBe(1);
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

    const result = await controller.setEstatus(1, { estatus: "bloqueado" });

    expect(service.setEstatus).toHaveBeenCalledWith(1, "bloqueado");
    expect(result.estatus).toBe("bloqueado");
  });
});
