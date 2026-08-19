import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { RutaNota } from "./ruta-nota.entity";
import { RutasNotasService } from "./rutas-notas.service";

describe("RutasNotasService", () => {
  let service: RutasNotasService;
  let rutaRepo: Repository<Ruta>;
  let notaRepo: Repository<RutaNota>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockNotaRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), delete: jest.fn() };

  function rutaFixture(overrides: Partial<Ruta> = {}): Ruta {
    return {
      id: 1,
      socioId: 1,
      cobradorId: 1,
      nombre: "Ruta Centro",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Ruta;
  }

  function notaFixture(overrides: Partial<RutaNota> = {}): RutaNota {
    return {
      id: 10,
      rutaId: 1,
      nota: "Cliente no disponible esta semana",
      creadoPorRol: "admin",
      creadoPorId: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as RutaNota;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RutasNotasService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaNota), useValue: mockNotaRepo },
      ],
    }).compile();

    service = module.get(RutasNotasService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    notaRepo = module.get(getRepositoryToken(RutaNota));
  });

  it("lanza NotFoundException si la ruta no existe al crear", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.crear(999, { nota: "x" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede crear notas en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.crear(1, { nota: "x" }, socioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("crea la nota registrando el autor", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (notaRepo.create as jest.Mock).mockImplementation((e: Partial<RutaNota>) => e as RutaNota);
    (notaRepo.save as jest.Mock).mockImplementation(async (n: RutaNota) => notaFixture({ ...n, id: 10 }));

    const result = await service.crear(1, { nota: "Cliente no disponible esta semana" }, adminContext);

    expect(notaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rutaId: 1,
        nota: "Cliente no disponible esta semana",
        creadoPorRol: "admin",
        creadoPorId: 0,
      }),
    );
    expect(result).toMatchObject({ id: 10, rutaId: 1, nota: "Cliente no disponible esta semana" });
  });

  it("lista las notas de la ruta ordenadas por created_at descendente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const notas = [notaFixture({ id: 2 }), notaFixture({ id: 1 })];
    (notaRepo.find as jest.Mock).mockResolvedValue(notas);

    const result = await service.listar(1, adminContext);

    expect(notaRepo.find).toHaveBeenCalledWith({
      where: { ruta: { id: 1 } },
      order: { createdAt: "DESC" },
    });
    expect(result).toHaveLength(2);
  });

  it("lanza NotFoundException al editar si la nota no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (notaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.editar(1, 999, { nota: "x" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("edita la nota sobreescribiendo el texto", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const nota = notaFixture();
    (notaRepo.findOne as jest.Mock).mockResolvedValue(nota);
    (notaRepo.save as jest.Mock).mockImplementation(async (n: RutaNota) => n);

    const result = await service.editar(1, 10, { nota: "Cliente pagó hoy" }, adminContext);

    expect(nota.nota).toBe("Cliente pagó hoy");
    expect(notaRepo.save).toHaveBeenCalledWith(nota);
    expect(result.nota).toBe("Cliente pagó hoy");
  });

  it("lanza NotFoundException al eliminar si la nota no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (notaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.eliminar(1, 999, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("elimina la nota físicamente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (notaRepo.findOne as jest.Mock).mockResolvedValue(notaFixture());
    (notaRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });

    const result = await service.eliminar(1, 10, adminContext);

    expect(notaRepo.delete).toHaveBeenCalledWith({ id: 10 });
    expect(result).toEqual({ id: 10 });
  });
});