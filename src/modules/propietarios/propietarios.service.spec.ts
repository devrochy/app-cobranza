import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Propietario } from "./propietario.entity";
import { CreatePropietarioInput, PropietariosService, UpdatePropietarioInput } from "./propietarios.service";

describe("PropietariosService", () => {
  let service: PropietariosService;
  let repo: Repository<Propietario>;

  const mockManager = {
    findOne: jest.fn(),
    save: jest.fn(async (entity: Partial<unknown>) => entity),
    find: jest.fn(),
    update: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn(
      async (cb: (m: typeof mockManager) => Promise<unknown>) => cb(mockManager),
    ),
  };

  const baseInput: CreatePropietarioInput = {
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

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn((entity: Partial<Propietario>) => entity as Propietario),
    save: jest.fn(async (entity: Partial<Propietario>) => entity as Propietario),
    createQueryBuilder: jest.fn(),
  };

  function propietarioConfigFixture(overrides: Partial<Propietario> = {}): Propietario {
    return {
      id: 1,
      ...baseInput,
      passwordHash: "hash",
      createdAt: new Date(),
      pais: null,
      nombreOficinaCobro: null,
      diasToleranciaCobro: 5,
      diasAnticipacionCobro: 3,
      ...overrides,
    } as Propietario;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropietariosService,
        { provide: getRepositoryToken(Propietario), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
        PasswordService,
      ],
    }).compile();

    service = module.get(PropietariosService);
    repo = module.get(getRepositoryToken(Propietario));
  });

  it("persiste el propietario con contraseña hasheada y devuelve sin passwordHash", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    (repo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, createdAt: new Date() });

    const result = await service.create(baseInput);

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Propietario>;
    expect(saved.passwordHash).toBeDefined();
    expect(saved.passwordHash).not.toBe(baseInput.password);
    expect(
      await new PasswordService().compare(baseInput.password, saved.passwordHash!),
    ).toBe(true);

    expect(Object.keys(result)).not.toContain("passwordHash");
    expect(result).toMatchObject({
      id: 1,
      usuario: "propietario1",
      codigo: "SC001",
      moneda: "BOB",
    });
  });

  it("persiste con estatus por defecto 'activo' si no se envía", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    const sinEstatus: CreatePropietarioInput = {
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

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Propietario>;
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
      usuario: "otro-propietario",
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
      usuario: "otro-propietario",
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
      usuario: "otro-propietario",
      codigo: "SC002",
      correo: "otro@correo.com",
      telefono: "+59170000001",
    });

    await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
  });

  describe("update", () => {
    function propietarioActual(): Propietario {
      return {
        id: 1,
        ...baseInput,
        passwordHash: "hash-viejo",
        createdAt: new Date(),
        pais: null,
        nombreOficinaCobro: null,
        diasToleranciaCobro: 5,
        diasAnticipacionCobro: 3,
      } as Propietario;
    }

    it("actualiza el perfil y devuelve sin passwordHash", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Propietario>) => ({
        ...propietarioActual(),
        ...e,
      }));

      const result = await service.update(1, { nombre: "Juan Carlos", apellido: "Pérez Soto" });

      expect(repo.save).toHaveBeenCalled();
      expect(result.nombre).toBe("Juan Carlos");
      expect(result.apellido).toBe("Pérez Soto");
      expect(Object.keys(result)).not.toContain("passwordHash");
    });

    it("re-hashea la contraseña cuando se envía una nueva", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Propietario>) => ({
        ...propietarioActual(),
        ...e,
      }));

      const result = await service.update(1, { password: "nueva-password" });

      const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Propietario>;
      expect(saved.passwordHash).toBeDefined();
      expect(saved.passwordHash).not.toBe("nueva-password");
      expect(
        await new PasswordService().compare("nueva-password", saved.passwordHash!),
      ).toBe(true);
      expect(Object.keys(result)).not.toContain("passwordHash");
    });

    it("lanza NotFoundException si el propietario no existe", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update(999, { nombre: "X" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza BadRequestException si no hay campos editables", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioActual());

      await expect(service.update(1, {} as UpdatePropietarioInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rechaza con 409 si el correo pertenece a otro propietario", async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(propietarioActual())
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

    it("rechaza con 409 si el teléfono pertenece a otro propietario", async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(propietarioActual())
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
        .mockResolvedValueOnce(propietarioActual())
        .mockResolvedValueOnce(propietarioActual());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Propietario>) => ({
        ...propietarioActual(),
        ...e,
      }));

      const result = await service.update(1, { correo: "juan@correo.com" });

      expect(result.id).toBe(1);
    });

    it("convierte una violación de unicidad de la BD (23505) en 409", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioActual());
      const uniqueError = new Error("duplicate key") as Error & { code?: string };
      uniqueError.code = "23505";
      (repo.save as jest.Mock).mockRejectedValue(uniqueError);

      await expect(service.update(1, { nombre: "X" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("setEstatus", () => {
    function propietarioActual(): Propietario {
      return {
        id: 1,
        usuario: "propietario1",
        passwordHash: "hash",
        nombre: "Juan",
        apellido: "Pérez",
        correo: "juan@correo.com",
        telefono: "+59170000001",
        codigo: "SC001",
        moneda: "BOB",
        estatus: "activo",
        createdAt: new Date(),
      } as Propietario;
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("bloquea al propietario y en cascada a sus gestores y carteras", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(propietarioActual());
      (mockManager.find as jest.Mock).mockResolvedValue([
        { id: 10, estatus: "activo" },
        { id: 11, estatus: "activo" },
      ]);
      (mockManager.save as jest.Mock).mockImplementation(async (e: Partial<Propietario>) => e);
      (mockManager.update as jest.Mock).mockResolvedValue({ affected: 2 });

      const result = await service.setEstatus(1, "bloqueado");

      expect(result.estatus).toBe("bloqueado");
      expect(Object.keys(result)).not.toContain("passwordHash");
      // 1 propietario + 2 gestores guardados, todos en bloqueado
      const savedBloqueados = (mockManager.save as jest.Mock).mock.calls
        .map((c: unknown[]) => c[0] as { estatus?: string })
        .filter((e: { estatus?: string }) => e && e.estatus === "bloqueado");
      expect(savedBloqueados.length).toBe(3);
      // las carteras de cada gestor se bloquean
      expect(mockManager.update).toHaveBeenCalledTimes(2);
      const routePatches = (mockManager.update as jest.Mock).mock.calls.map(
        (c: unknown[]) => c[2] as { estatus?: string },
      );
      expect(routePatches.every((p: { estatus?: string }) => p.estatus === "bloqueado")).toBe(true);
    });

    it("reactiva al propietario y en cascada a sus gestores y carteras", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue({ ...propietarioActual(), estatus: "bloqueado" });
      (mockManager.find as jest.Mock).mockResolvedValue([{ id: 10, estatus: "bloqueado" }]);
      (mockManager.save as jest.Mock).mockImplementation(async (e: Partial<Propietario>) => e);
      (mockManager.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.setEstatus(1, "activo");

      expect(result.estatus).toBe("activo");
      const routePatches = (mockManager.update as jest.Mock).mock.calls.map(
        (c: unknown[]) => c[2] as { estatus?: string },
      );
      expect(routePatches.every((p: { estatus?: string }) => p.estatus === "activo")).toBe(true);
    });

    it("revierte (rollback) si falla la cascada de carteras", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(propietarioActual());
      (mockManager.find as jest.Mock).mockResolvedValue([{ id: 10, estatus: "activo" }]);
      (mockManager.save as jest.Mock).mockResolvedValue({});
      (mockManager.update as jest.Mock).mockRejectedValue(new Error("db down"));

      await expect(service.setEstatus(1, "bloqueado")).rejects.toThrow("db down");
    });

    it("lanza NotFoundException si el propietario no existe", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.setEstatus(999, "bloqueado")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("obtener", () => {
    it("lanza NotFound si el propietario no existe", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.obtener(999)).rejects.toThrow(NotFoundException);
    });

    it("devuelve el propietario completo con los campos de configuración", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...propietarioConfigFixture(),
        pais: "BO",
        nombreOficinaCobro: "Oficina Central",
        diasToleranciaCobro: 3,
      });
      const res = await service.obtener(1);
      expect(res.pais).toBe("BO");
      expect(res.nombreOficinaCobro).toBe("Oficina Central");
      expect(res.diasToleranciaCobro).toBe(3);
    });
  });

  describe("actualizarConfiguracion", () => {
    const adminCtx = { rol: "admin" as const, sub: 1 };
    const propietarioCtx = { rol: "propietario" as const, sub: 1 };

    it("lanza NotFound si el propietario no existe", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.actualizarConfiguracion(999, { nombreOficinaCobro: "Oficina" }, adminCtx),
      ).rejects.toThrow(NotFoundException);
    });

    it("un propietario no puede configurar a otro propietario (403)", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioConfigFixture());
      await expect(
        service.actualizarConfiguracion(2, { nombreOficinaCobro: "Oficina" }, propietarioCtx),
      ).rejects.toThrow(ForbiddenException);
    });

    it("un propietario puede configurar su propio propietario", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioConfigFixture());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Propietario>) => ({
        ...propietarioConfigFixture(),
        ...e,
      }));
      const res = await service.actualizarConfiguracion(
        1,
        { nombreOficinaCobro: "Mi Oficina" },
        propietarioCtx,
      );
      expect(res.nombreOficinaCobro).toBe("Mi Oficina");
    });

    it("rechaza sin campos para actualizar", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioConfigFixture());
      await expect(service.actualizarConfiguracion(1, {}, adminCtx)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("actualiza los campos de configuración", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioConfigFixture());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Propietario>) => ({
        ...propietarioConfigFixture(),
        ...e,
      }));
      const res = await service.actualizarConfiguracion(
        1,
        { pais: "PE", nombreOficinaCobro: "Oficina Sur", diasToleranciaCobro: 5 },
        adminCtx,
      );
      expect(res.pais).toBe("PE");
      expect(res.nombreOficinaCobro).toBe("Oficina Sur");
      expect(res.diasToleranciaCobro).toBe(5);
    });

    it("actualiza diasAnticipacionCobro", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(propietarioConfigFixture());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Propietario>) => ({
        ...propietarioConfigFixture(),
        ...e,
      }));
      const res = await service.actualizarConfiguracion(
        1,
        { diasAnticipacionCobro: 5 },
        adminCtx,
      );
      expect(res.diasAnticipacionCobro).toBe(5);
    });
  });

  describe("listar", () => {
    const propietario1: Propietario = {
      id: 1,
      usuario: "propietario1",
      passwordHash: "hash",
      nombre: "Juan",
      apellido: "Pérez",
      correo: "juan@correo.com",
      telefono: "+59170000001",
      codigo: "SC001",
      moneda: "BOB",
      pais: null,
      nombreOficinaCobro: null,
      diasToleranciaCobro: 5,
      diasAnticipacionCobro: 3,
      estatus: "activo",
      createdAt: new Date(),
    } as Propietario;
    const propietario2: Propietario = {
      ...propietario1,
      id: 2,
      usuario: "propietario2",
      codigo: "SC002",
      correo: "maria@correo.com",
      estatus: "bloqueado",
    };

    function mockQueryBuilder(rows: Propietario[]) {
      return {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("lista todos los propietarios sin filtros en orden id ASC y sin passwordHash", async () => {
      const qb = mockQueryBuilder([propietario1, propietario2]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const res = await service.listar({});

      expect(repo.createQueryBuilder).toHaveBeenCalledWith("propietario");
      expect(qb.orderBy).toHaveBeenCalledWith("propietario.id", "ASC");
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(res).toHaveLength(2);
      expect(res.map((s) => s.codigo)).toEqual(["SC001", "SC002"]);
      expect(Object.keys(res[0])).not.toContain("passwordHash");
    });

    it("filtra por busqueda con ILIKE aplicando trim", async () => {
      const qb = mockQueryBuilder([propietario1]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ busqueda: "  juan  " });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE"),
        { termino: "%juan%" },
      );
    });

    it("filtra por estatus", async () => {
      const qb = mockQueryBuilder([propietario2]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ estatus: "bloqueado" });

      expect(qb.andWhere).toHaveBeenCalledWith("propietario.estatus = :estatus", {
        estatus: "bloqueado",
      });
    });

    it("aplica busqueda y estatus juntos", async () => {
      const qb = mockQueryBuilder([]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ busqueda: "juan", estatus: "activo" });

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it("ignora una busqueda vacía o de solo espacios", async () => {
      const qb = mockQueryBuilder([propietario1]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ busqueda: "   " });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it("un propietario solo ve su propio perfil (ownership)", async () => {
      const qb = mockQueryBuilder([propietario1]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({}, { rol: "propietario", sub: 7 });

      expect(qb.andWhere).toHaveBeenCalledWith("propietario.id = :propietarioId", {
        propietarioId: 7,
      });
    });
  });
});
