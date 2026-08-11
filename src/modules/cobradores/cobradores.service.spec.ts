import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "./cobrador.entity";
import { CobradoresService, CreateCobradorInput } from "./cobradores.service";

describe("CobradoresService", () => {
  let service: CobradoresService;
  let cobradorRepo: Repository<Cobrador>;
  let socioRepo: Repository<Socio>;

  const baseInput: CreateCobradorInput = {
    socioId: 1,
    usuario: "cobrador1",
    password: "password-seguro",
    nombre: "Carlos",
    apellido: "López",
    correo: "carlos@correo.com",
    telefono: "+59171111111",
    codigo: "CB001",
  };

  const mockCobradorRepo = {
    findOne: jest.fn(),
    create: jest.fn((entity: Partial<Cobrador>) => entity as Cobrador),
    save: jest.fn(async (entity: Partial<Cobrador>) => entity as Cobrador),
  };

  const mockSocioRepo = {
    findOne: jest.fn(),
  };

  function socioFixture(overrides: Partial<Socio> = {}): Socio {
    return { id: 1, usuario: "socio1", estatus: "activo", ...overrides } as Socio;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobradoresService,
        { provide: getRepositoryToken(Cobrador), useValue: mockCobradorRepo },
        { provide: getRepositoryToken(Socio), useValue: mockSocioRepo },
        PasswordService,
      ],
    }).compile();

    service = module.get(CobradoresService);
    cobradorRepo = module.get(getRepositoryToken(Cobrador));
    socioRepo = module.get(getRepositoryToken(Socio));
  });

  it("persiste con contraseña hasheada y devuelve sin passwordHash con socioId", async () => {
    (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
    (cobradorRepo.findOne as jest.Mock).mockResolvedValue(null);
    (cobradorRepo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, createdAt: new Date() });

    const result = await service.create(baseInput);

    expect(cobradorRepo.save).toHaveBeenCalledTimes(1);
    const saved = (cobradorRepo.save as jest.Mock).mock.calls[0][0] as Partial<Cobrador>;
    expect(saved.passwordHash).toBeDefined();
    expect(saved.passwordHash).not.toBe(baseInput.password);
    expect(
      await new PasswordService().compare(baseInput.password, saved.passwordHash!),
    ).toBe(true);

    expect(Object.keys(result)).not.toContain("passwordHash");
    expect(result.socioId).toBe(1);
  });

  it("lanza NotFoundException si el socio no existe", async () => {
    (socioRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.create(baseInput)).rejects.toThrow(NotFoundException);
  });

  it("lanza ConflictException si el socio está bloqueado", async () => {
    (socioRepo.findOne as jest.Mock).mockResolvedValue(
      socioFixture({ estatus: "bloqueado" }),
    );

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });

  describe.each([
    ["usuario", "cobrador1"],
    ["codigo", "CB001"],
    ["correo", "carlos@correo.com"],
    ["telefono", "+59171111111"],
  ])("campo único '%s'", (campo, valor) => {
    it(`rechaza con 409 si el ${campo} ya está registrado`, async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      const existing = {
        id: 99,
        ...baseInput,
        passwordHash: "x",
        usuario: "otro-cobrador",
        codigo: "CB999",
        correo: "otro@correo.com",
        telefono: "+59100000000",
        [campo]: valor,
      };
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(existing);

      await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
    });
  });

  it("persiste con estatus por defecto 'activo' si no se envía", async () => {
    (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
    (cobradorRepo.findOne as jest.Mock).mockResolvedValue(null);
    const sinEstatus: CreateCobradorInput = {
      socioId: baseInput.socioId,
      usuario: baseInput.usuario,
      password: baseInput.password,
      nombre: baseInput.nombre,
      apellido: baseInput.apellido,
      correo: baseInput.correo,
      telefono: baseInput.telefono,
      codigo: baseInput.codigo,
    };

    await service.create(sinEstatus);

    const saved = (cobradorRepo.save as jest.Mock).mock.calls[0][0] as Partial<Cobrador>;
    expect(saved.estatus).toBe("activo");
  });

  it("convierte una violación de unicidad de la BD (23505) en 409", async () => {
    (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
    (cobradorRepo.findOne as jest.Mock).mockResolvedValue(null);
    const uniqueError = new Error("duplicate key") as Error & { code?: string };
    uniqueError.code = "23505";
    (cobradorRepo.save as jest.Mock).mockRejectedValue(uniqueError);

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });
});
