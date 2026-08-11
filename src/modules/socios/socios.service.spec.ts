import { ConflictException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Socio } from "./socio.entity";
import { CreateSocioInput, SociosService } from "./socios.service";

describe("SociosService", () => {
  let service: SociosService;
  let repo: Repository<Socio>;

  const baseInput: CreateSocioInput = {
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

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn((entity: Partial<Socio>) => entity as Socio),
    save: jest.fn(async (entity: Partial<Socio>) => entity as Socio),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SociosService,
        { provide: getRepositoryToken(Socio), useValue: mockRepo },
        PasswordService,
      ],
    }).compile();

    service = module.get(SociosService);
    repo = module.get(getRepositoryToken(Socio));
  });

  it("persiste el socio con contraseña hasheada y devuelve sin passwordHash", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    (repo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, createdAt: new Date() });

    const result = await service.create(baseInput);

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Socio>;
    expect(saved.passwordHash).toBeDefined();
    expect(saved.passwordHash).not.toBe(baseInput.password);
    expect(
      await new PasswordService().compare(baseInput.password, saved.passwordHash!),
    ).toBe(true);

    expect(Object.keys(result)).not.toContain("passwordHash");
    expect(result).toMatchObject({
      id: 1,
      usuario: "socio1",
      codigo: "SC001",
      moneda: "BOB",
    });
  });

  it("persiste con estatus por defecto 'activo' si no se envía", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    const sinEstatus: CreateSocioInput = {
      usuario: baseInput.usuario,
      password: baseInput.password,
      nombre: baseInput.nombre,
      apellido: baseInput.apellido,
      correo: baseInput.correo,
      telefono: baseInput.telefono,
      codigo: baseInput.codigo,
      moneda: baseInput.moneda,
    };

    await service.create(sinEstatus);

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Socio>;
    expect(saved.estatus).toBe("activo");
  });

  it("convierte una violación de unicidad de la BD (23505) en 409", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    const uniqueError = new Error("duplicate key") as Error & { code?: string };
    uniqueError.code = "23505";
    (repo.save as jest.Mock).mockRejectedValue(uniqueError);

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });

  it("rechaza con 409 si el usuario ya está registrado", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      ...baseInput,
      passwordHash: "x",
      telefono: "+59100000000",
    });

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });

  it("rechaza con 409 si el código ya está registrado", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({
      id: 2,
      ...baseInput,
      passwordHash: "x",
      usuario: "otro-socio",
      codigo: "SC001",
      telefono: "+59100000000",
    });

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });

  it("rechaza con 409 si el correo ya está registrado", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({
      id: 3,
      ...baseInput,
      passwordHash: "x",
      usuario: "otro-socio",
      codigo: "SC002",
      correo: "juan@correo.com",
      telefono: "+59100000000",
    });

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });

  it("rechaza con 409 si el teléfono ya está registrado", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({
      id: 4,
      ...baseInput,
      passwordHash: "x",
      usuario: "otro-socio",
      codigo: "SC002",
      correo: "otro@correo.com",
      telefono: "+59170000001",
    });

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });
});
