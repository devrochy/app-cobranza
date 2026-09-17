import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Propietario } from "../propietarios/propietario.entity";
import { Gestor } from "./gestor.entity";
import {
  GestoresService,
  CreateGestorInput,
  UpdateGestorInput,
} from "./gestores.service";

describe("GestoresService", () => {
  let service: GestoresService;
  let gestorRepo: Repository<Gestor>;
  let propietarioRepo: Repository<Propietario>;

  const mockManager = {
    findOne: jest.fn(),
    save: jest.fn(async (entity: Partial<unknown>) => entity),
    update: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn(
      async (cb: (m: typeof mockManager) => Promise<unknown>) => cb(mockManager),
    ),
  };

  const baseInput: CreateGestorInput = {
    propietarioId: 1,
    usuario: "gestor1",
    password: "password-seguro",
    nombre: "Carlos",
    apellido: "López",
    correo: "carlos@correo.com",
    telefono: "+59171111111",
    codigo: "CB001",
  };

  const mockGestorRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((entity: Partial<Gestor>) => entity as Gestor),
    save: jest.fn(async (entity: Partial<Gestor>) => entity as Gestor),
  };

  const mockPropietarioRepo = {
    findOne: jest.fn(),
  };

  function propietarioFixture(overrides: Partial<Propietario> = {}): Propietario {
    return { id: 1, usuario: "propietario1", estatus: "activo", ...overrides } as Propietario;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GestoresService,
        { provide: getRepositoryToken(Gestor), useValue: mockGestorRepo },
        { provide: getRepositoryToken(Propietario), useValue: mockPropietarioRepo },
        { provide: DataSource, useValue: mockDataSource },
        PasswordService,
      ],
    }).compile();

    service = module.get(GestoresService);
    gestorRepo = module.get(getRepositoryToken(Gestor));
    propietarioRepo = module.get(getRepositoryToken(Propietario));
  });

  it("persiste con contraseña hasheada y devuelve sin passwordHash con propietarioId", async () => {
    (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
    (gestorRepo.findOne as jest.Mock).mockResolvedValue(null);
    (gestorRepo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, createdAt: new Date() });

    const result = await service.create(baseInput);

    expect(gestorRepo.save).toHaveBeenCalledTimes(1);
    const saved = (gestorRepo.save as jest.Mock).mock.calls[0][0] as Partial<Gestor>;
    expect(saved.passwordHash).toBeDefined();
    expect(saved.passwordHash).not.toBe(baseInput.password);
    expect(
      await new PasswordService().compare(baseInput.password, saved.passwordHash!),
    ).toBe(true);

    expect(Object.keys(result)).not.toContain("passwordHash");
    expect(result.propietarioId).toBe(1);
  });

  it("lanza NotFoundException si el propietario no existe", async () => {
    (propietarioRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.create(baseInput)).rejects.toThrow(NotFoundException);
  });

  it("lanza ConflictException si el propietario está bloqueado", async () => {
    (propietarioRepo.findOne as jest.Mock).mockResolvedValue(
      propietarioFixture({ estatus: "bloqueado" }),
    );

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });

  describe.each([
    ["usuario", "gestor1"],
    ["codigo", "CB001"],
    ["correo", "carlos@correo.com"],
    ["telefono", "+59171111111"],
  ])("campo único '%s'", (campo, valor) => {
    it(`rechaza con 409 si el ${campo} ya está registrado`, async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      const existing = {
        id: 99,
        ...baseInput,
        passwordHash: "x",
        usuario: "otro-gestor",
        codigo: "CB999",
        correo: "otro@correo.com",
        telefono: "+59100000000",
        [campo]: valor,
      };
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(existing);

      await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
    });
  });

  it("persiste con estatus por defecto 'activo' si no se envía", async () => {
    (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
    (gestorRepo.findOne as jest.Mock).mockResolvedValue(null);
    const sinEstatus: CreateGestorInput = {
      propietarioId: baseInput.propietarioId,
      usuario: baseInput.usuario,
      password: baseInput.password,
      nombre: baseInput.nombre,
      apellido: baseInput.apellido,
      correo: baseInput.correo,
      telefono: baseInput.telefono,
      codigo: baseInput.codigo,
    };

    await service.create(sinEstatus);

    const saved = (gestorRepo.save as jest.Mock).mock.calls[0][0] as Partial<Gestor>;
    expect(saved.estatus).toBe("activo");
  });

  it("convierte una violación de unicidad de la BD (23505) en 409", async () => {
    (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
    (gestorRepo.findOne as jest.Mock).mockResolvedValue(null);
    const uniqueError = new Error("duplicate key") as Error & { code?: string };
    uniqueError.code = "23505";
    (gestorRepo.save as jest.Mock).mockRejectedValue(uniqueError);

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });

  describe("update", () => {
    function gestorActual(): Gestor {
      return {
        id: 1,
        propietario: { id: 1 } as Propietario,
        ...baseInput,
        passwordHash: "hash-viejo",
        createdAt: new Date(),
      } as Gestor;
    }

    it("actualiza el perfil y devuelve sin passwordHash", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorActual());
      (gestorRepo.save as jest.Mock).mockImplementation(async (e: Partial<Gestor>) => ({
        ...gestorActual(),
        ...e,
      }));

      const result = await service.update(1, { nombre: "Carlos Eduardo" });

      expect(gestorRepo.save).toHaveBeenCalled();
      expect(result.nombre).toBe("Carlos Eduardo");
      expect(Object.keys(result)).not.toContain("passwordHash");
    });

    it("re-hashea la contraseña cuando se envía una nueva", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorActual());
      (gestorRepo.save as jest.Mock).mockImplementation(async (e: Partial<Gestor>) => ({
        ...gestorActual(),
        ...e,
      }));

      await service.update(1, { password: "nueva-password" });

      const saved = (gestorRepo.save as jest.Mock).mock.calls[0][0] as Partial<Gestor>;
      expect(saved.passwordHash).toBeDefined();
      expect(saved.passwordHash).not.toBe("nueva-password");
      expect(
        await new PasswordService().compare("nueva-password", saved.passwordHash!),
      ).toBe(true);
    });

    it("lanza NotFoundException si el gestor no existe", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update(999, { nombre: "X" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza BadRequestException si no hay campos editables", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorActual());

      await expect(service.update(1, {} as UpdateGestorInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rechaza con 409 si el correo pertenece a otro gestor", async () => {
      (gestorRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(gestorActual())
        .mockResolvedValueOnce({
          id: 2,
          ...baseInput,
          passwordHash: "x",
          usuario: "otro-gestor",
          correo: "otro@correo.com",
          telefono: "+59100000000",
        });

      await expect(
        service.update(1, { correo: "otro@correo.com" }),
      ).rejects.toThrow(ConflictException);
    });

    it("rechaza con 409 si el teléfono pertenece a otro gestor", async () => {
      (gestorRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(gestorActual())
        .mockResolvedValueOnce({
          id: 2,
          ...baseInput,
          passwordHash: "x",
          usuario: "otro-gestor",
          correo: "otro@correo.com",
          telefono: "+59100000000",
        });

      await expect(
        service.update(1, { telefono: "+59100000000" }),
      ).rejects.toThrow(ConflictException);
    });

    it("no rechaza si el correo coincide con el propio registro", async () => {
      (gestorRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(gestorActual())
        .mockResolvedValueOnce(gestorActual());
      (gestorRepo.save as jest.Mock).mockImplementation(async (e: Partial<Gestor>) => ({
        ...gestorActual(),
        ...e,
      }));

      const result = await service.update(1, { correo: "carlos@correo.com" });

      expect(result.id).toBe(1);
    });

    it("convierte una violación de unicidad de la BD (23505) en 409", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorActual());
      const uniqueError = new Error("duplicate key") as Error & { code?: string };
      uniqueError.code = "23505";
      (gestorRepo.save as jest.Mock).mockRejectedValue(uniqueError);

      await expect(service.update(1, { nombre: "X" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("listar", () => {
    it("filtra por propietario cuando recibe propietarioId", async () => {
      (gestorRepo.find as jest.Mock).mockResolvedValue([]);

      await service.listar(7);

      expect((gestorRepo.find as jest.Mock)).toHaveBeenCalledWith({
        where: { propietario: { id: 7 } },
        order: { id: "ASC" },
      });
    });

    it("devuelve todos cuando no recibe propietarioId", async () => {
      (gestorRepo.find as jest.Mock).mockResolvedValue([]);

      await service.listar();

      expect((gestorRepo.find as jest.Mock)).toHaveBeenCalledWith({ order: { id: "ASC" } });
    });

    it("no expone passwordHash en el resultado", async () => {
      (gestorRepo.find as jest.Mock).mockResolvedValue([
        {
          id: 1,
          propietario: { id: 1 } as Propietario,
          ...baseInput,
          passwordHash: "hash",
          createdAt: new Date(),
        } as Gestor,
      ]);

      const result = await service.listar();

      expect(result[0]).toBeDefined();
      expect(Object.keys(result[0])).not.toContain("passwordHash");
    });
  });

  describe("setEstatus", () => {
    function gestorActual(): Gestor {
      return {
        id: 1,
        propietario: { id: 1 } as Propietario,
        ...baseInput,
        passwordHash: "hash",
        createdAt: new Date(),
      } as Gestor;
    }

    it("bloquea al gestor y sus carteras en la misma transacción", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(gestorActual());
      (mockManager.save as jest.Mock).mockImplementation(async (e: Partial<Gestor>) => ({
        ...gestorActual(),
        ...e,
      }));
      (mockManager.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.setEstatus(1, "bloqueado");

      expect(result.estatus).toBe("bloqueado");
      expect(Object.keys(result)).not.toContain("passwordHash");
      expect(mockManager.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ gestor: { id: 1 } }),
        expect.objectContaining({ estatus: "bloqueado" }),
      );
    });

    it("reactiva al gestor y sus carteras", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue({ ...gestorActual(), estatus: "bloqueado" });
      (mockManager.save as jest.Mock).mockImplementation(async (e: Partial<Gestor>) => ({
        ...gestorActual(),
        ...e,
      }));
      (mockManager.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.setEstatus(1, "activo");

      expect(result.estatus).toBe("activo");
      expect(mockManager.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ gestor: { id: 1 } }),
        expect.objectContaining({ estatus: "activo" }),
      );
    });

    it("revierte (rollback) si falla la cascada de carteras", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(gestorActual());
      (mockManager.save as jest.Mock).mockResolvedValue({});
      (mockManager.update as jest.Mock).mockRejectedValue(new Error("db down"));

      await expect(service.setEstatus(1, "bloqueado")).rejects.toThrow("db down");
    });

    it("lanza NotFoundException si el gestor no existe", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.setEstatus(999, "bloqueado")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
