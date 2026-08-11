import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Socio } from "./socio.entity";
import { CreateSocioInput, SociosService, UpdateSocioInput } from "./socios.service";

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

  describe("update", () => {
    function socioActual(): Socio {
      return { id: 1, ...baseInput, passwordHash: "hash-viejo", createdAt: new Date() } as Socio;
    }

    it("actualiza el perfil y devuelve sin passwordHash", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioActual(),
        ...e,
      }));

      const result = await service.update(1, { nombre: "Juan Carlos", apellido: "Pérez Soto" });

      expect(repo.save).toHaveBeenCalled();
      expect(result.nombre).toBe("Juan Carlos");
      expect(result.apellido).toBe("Pérez Soto");
      expect(Object.keys(result)).not.toContain("passwordHash");
    });

    it("re-hashea la contraseña cuando se envía una nueva", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioActual(),
        ...e,
      }));

      const result = await service.update(1, { password: "nueva-password" });

      const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Socio>;
      expect(saved.passwordHash).toBeDefined();
      expect(saved.passwordHash).not.toBe("nueva-password");
      expect(
        await new PasswordService().compare("nueva-password", saved.passwordHash!),
      ).toBe(true);
      expect(Object.keys(result)).not.toContain("passwordHash");
    });

    it("lanza NotFoundException si el socio no existe", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update(999, { nombre: "X" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza BadRequestException si no hay campos editables", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioActual());

      await expect(service.update(1, {} as UpdateSocioInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rechaza con 409 si el correo pertenece a otro socio", async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(socioActual())
        .mockResolvedValueOnce({
          id: 2,
          ...baseInput,
          passwordHash: "x",
          correo: "otro@correo.com",
          telefono: "+59100000000",
        });

      await expect(service.update(1, { correo: "otro@correo.com" })).rejects.toThrow(
        ConflictException,
      );
    });

    it("rechaza con 409 si el teléfono pertenece a otro socio", async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(socioActual())
        .mockResolvedValueOnce({
          id: 2,
          ...baseInput,
          passwordHash: "x",
          correo: "otro@correo.com",
          telefono: "+59100000000",
        });

      await expect(service.update(1, { telefono: "+59100000000" })).rejects.toThrow(
        ConflictException,
      );
    });

    it("no rechaza si el correo coincide con el propio registro", async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(socioActual())
        .mockResolvedValueOnce(socioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioActual(),
        ...e,
      }));

      const result = await service.update(1, { correo: "juan@correo.com" });

      expect(result.id).toBe(1);
    });

    it("convierte una violación de unicidad de la BD (23505) en 409", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioActual());
      const uniqueError = new Error("duplicate key") as Error & { code?: string };
      uniqueError.code = "23505";
      (repo.save as jest.Mock).mockRejectedValue(uniqueError);

      await expect(service.update(1, { nombre: "X" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("setEstatus", () => {
    function socioActual(): Socio {
      return {
        id: 1,
        usuario: "socio1",
        passwordHash: "hash",
        nombre: "Juan",
        apellido: "Pérez",
        correo: "juan@correo.com",
        telefono: "+59170000001",
        codigo: "SC001",
        moneda: "BOB",
        estatus: "activo",
        createdAt: new Date(),
      } as Socio;
    }

    it("bloquea al socio y devuelve sin passwordHash", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioActual(),
        ...e,
      }));

      const result = await service.setEstatus(1, "bloqueado");

      expect(repo.save).toHaveBeenCalled();
      expect(result.estatus).toBe("bloqueado");
      expect(Object.keys(result)).not.toContain("passwordHash");
    });

    it("reactiva al socio", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioActual(),
        ...e,
      }));

      const result = await service.setEstatus(1, "activo");

      expect(result.estatus).toBe("activo");
    });

    it("es idempotente: aplicar el mismo estatus no falla", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioActual(),
        ...e,
      }));

      await expect(service.setEstatus(1, "activo")).resolves.toBeDefined();
    });

    it("lanza NotFoundException si el socio no existe", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.setEstatus(999, "bloqueado")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
