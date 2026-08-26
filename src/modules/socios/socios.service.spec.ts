import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Socio } from "./socio.entity";
import { CreateSocioInput, SociosService, UpdateSocioInput } from "./socios.service";

describe("SociosService", () => {
  let service: SociosService;
  let repo: Repository<Socio>;

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
    createQueryBuilder: jest.fn(),
  };

  function socioConfigFixture(overrides: Partial<Socio> = {}): Socio {
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
    } as Socio;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SociosService,
        { provide: getRepositoryToken(Socio), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
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
      return {
        id: 1,
        ...baseInput,
        passwordHash: "hash-viejo",
        createdAt: new Date(),
        pais: null,
        nombreOficinaCobro: null,
        diasToleranciaCobro: 5,
        diasAnticipacionCobro: 3,
      } as Socio;
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

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("bloquea al socio y en cascada a sus cobradores y rutas", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(socioActual());
      (mockManager.find as jest.Mock).mockResolvedValue([
        { id: 10, estatus: "activo" },
        { id: 11, estatus: "activo" },
      ]);
      (mockManager.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => e);
      (mockManager.update as jest.Mock).mockResolvedValue({ affected: 2 });

      const result = await service.setEstatus(1, "bloqueado");

      expect(result.estatus).toBe("bloqueado");
      expect(Object.keys(result)).not.toContain("passwordHash");
      // 1 socio + 2 cobradores guardados, todos en bloqueado
      const savedBloqueados = (mockManager.save as jest.Mock).mock.calls
        .map((c: unknown[]) => c[0] as { estatus?: string })
        .filter((e: { estatus?: string }) => e && e.estatus === "bloqueado");
      expect(savedBloqueados.length).toBe(3);
      // las rutas de cada cobrador se bloquean
      expect(mockManager.update).toHaveBeenCalledTimes(2);
      const routePatches = (mockManager.update as jest.Mock).mock.calls.map(
        (c: unknown[]) => c[2] as { estatus?: string },
      );
      expect(routePatches.every((p: { estatus?: string }) => p.estatus === "bloqueado")).toBe(true);
    });

    it("reactiva al socio y en cascada a sus cobradores y rutas", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue({ ...socioActual(), estatus: "bloqueado" });
      (mockManager.find as jest.Mock).mockResolvedValue([{ id: 10, estatus: "bloqueado" }]);
      (mockManager.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => e);
      (mockManager.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.setEstatus(1, "activo");

      expect(result.estatus).toBe("activo");
      const routePatches = (mockManager.update as jest.Mock).mock.calls.map(
        (c: unknown[]) => c[2] as { estatus?: string },
      );
      expect(routePatches.every((p: { estatus?: string }) => p.estatus === "activo")).toBe(true);
    });

    it("revierte (rollback) si falla la cascada de rutas", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(socioActual());
      (mockManager.find as jest.Mock).mockResolvedValue([{ id: 10, estatus: "activo" }]);
      (mockManager.save as jest.Mock).mockResolvedValue({});
      (mockManager.update as jest.Mock).mockRejectedValue(new Error("db down"));

      await expect(service.setEstatus(1, "bloqueado")).rejects.toThrow("db down");
    });

    it("lanza NotFoundException si el socio no existe", async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.setEstatus(999, "bloqueado")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("obtener", () => {
    it("lanza NotFound si el socio no existe", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.obtener(999)).rejects.toThrow(NotFoundException);
    });

    it("devuelve el socio completo con los campos de configuración", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...socioConfigFixture(),
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
    const socioCtx = { rol: "socio" as const, sub: 1 };

    it("lanza NotFound si el socio no existe", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.actualizarConfiguracion(999, { nombreOficinaCobro: "Oficina" }, adminCtx),
      ).rejects.toThrow(NotFoundException);
    });

    it("un socio no puede configurar a otro socio (403)", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioConfigFixture());
      await expect(
        service.actualizarConfiguracion(2, { nombreOficinaCobro: "Oficina" }, socioCtx),
      ).rejects.toThrow(ForbiddenException);
    });

    it("un socio puede configurar su propio socio", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioConfigFixture());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioConfigFixture(),
        ...e,
      }));
      const res = await service.actualizarConfiguracion(
        1,
        { nombreOficinaCobro: "Mi Oficina" },
        socioCtx,
      );
      expect(res.nombreOficinaCobro).toBe("Mi Oficina");
    });

    it("rechaza sin campos para actualizar", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioConfigFixture());
      await expect(service.actualizarConfiguracion(1, {}, adminCtx)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("actualiza los campos de configuración", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(socioConfigFixture());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioConfigFixture(),
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
      (repo.findOne as jest.Mock).mockResolvedValue(socioConfigFixture());
      (repo.save as jest.Mock).mockImplementation(async (e: Partial<Socio>) => ({
        ...socioConfigFixture(),
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
    const socio1: Socio = {
      id: 1,
      usuario: "socio1",
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
    } as Socio;
    const socio2: Socio = {
      ...socio1,
      id: 2,
      usuario: "socio2",
      codigo: "SC002",
      correo: "maria@correo.com",
      estatus: "bloqueado",
    };

    function mockQueryBuilder(rows: Socio[]) {
      return {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("lista todos los socios sin filtros en orden id ASC y sin passwordHash", async () => {
      const qb = mockQueryBuilder([socio1, socio2]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const res = await service.listar({});

      expect(repo.createQueryBuilder).toHaveBeenCalledWith("socio");
      expect(qb.orderBy).toHaveBeenCalledWith("socio.id", "ASC");
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(res).toHaveLength(2);
      expect(res.map((s) => s.codigo)).toEqual(["SC001", "SC002"]);
      expect(Object.keys(res[0])).not.toContain("passwordHash");
    });

    it("filtra por busqueda con ILIKE aplicando trim", async () => {
      const qb = mockQueryBuilder([socio1]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ busqueda: "  juan  " });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE"),
        { termino: "%juan%" },
      );
    });

    it("filtra por estatus", async () => {
      const qb = mockQueryBuilder([socio2]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ estatus: "bloqueado" });

      expect(qb.andWhere).toHaveBeenCalledWith("socio.estatus = :estatus", {
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
      const qb = mockQueryBuilder([socio1]);
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ busqueda: "   " });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });
});
