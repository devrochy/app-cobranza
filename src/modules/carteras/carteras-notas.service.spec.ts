import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cartera } from "./cartera.entity";
import { CarteraNota } from "./cartera-nota.entity";
import { CarterasNotasService } from "./carteras-notas.service";

describe("CarterasNotasService", () => {
  let service: CarterasNotasService;
  let carteraRepo: Repository<Cartera>;
  let notaRepo: Repository<CarteraNota>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockNotaRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), delete: jest.fn() };

  function carteraFixture(overrides: Partial<Cartera> = {}): Cartera {
    return {
      id: 1,
      propietarioId: 1,
      gestorId: 1,
      nombre: "Cartera Centro",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Cartera;
  }

  function notaFixture(overrides: Partial<CarteraNota> = {}): CarteraNota {
    return {
      id: 10,
      carteraId: 1,
      nota: "Cliente no disponible esta semana",
      creadoPorRol: "admin",
      creadoPorId: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as CarteraNota;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarterasNotasService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(CarteraNota), useValue: mockNotaRepo },
      ],
    }).compile();

    service = module.get(CarterasNotasService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    notaRepo = module.get(getRepositoryToken(CarteraNota));
  });

  it("lanza NotFoundException si la cartera no existe al crear", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.crear(999, { nota: "x" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede crear notas en una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(
      service.crear(1, { nota: "x" }, propietarioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("crea la nota registrando el autor", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (notaRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraNota>) => e as CarteraNota);
    (notaRepo.save as jest.Mock).mockImplementation(async (n: CarteraNota) => notaFixture({ ...n, id: 10 }));

    const result = await service.crear(1, { nota: "Cliente no disponible esta semana" }, adminContext);

    expect(notaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        carteraId: 1,
        nota: "Cliente no disponible esta semana",
        creadoPorRol: "admin",
        creadoPorId: 0,
      }),
    );
    expect(result).toMatchObject({ id: 10, carteraId: 1, nota: "Cliente no disponible esta semana" });
  });

  it("lista las notas de la cartera ordenadas por created_at descendente", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const notas = [notaFixture({ id: 2 }), notaFixture({ id: 1 })];
    (notaRepo.find as jest.Mock).mockResolvedValue(notas);

    const result = await service.listar(1, adminContext);

    expect(notaRepo.find).toHaveBeenCalledWith({
      where: { cartera: { id: 1 } },
      order: { createdAt: "DESC" },
    });
    expect(result).toHaveLength(2);
  });

  it("lanza NotFoundException al editar si la nota no existe en la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (notaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.editar(1, 999, { nota: "x" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("edita la nota sobreescribiendo el texto", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const nota = notaFixture();
    (notaRepo.findOne as jest.Mock).mockResolvedValue(nota);
    (notaRepo.save as jest.Mock).mockImplementation(async (n: CarteraNota) => n);

    const result = await service.editar(1, 10, { nota: "Cliente pagó hoy" }, adminContext);

    expect(nota.nota).toBe("Cliente pagó hoy");
    expect(notaRepo.save).toHaveBeenCalledWith(nota);
    expect(result.nota).toBe("Cliente pagó hoy");
  });

  it("lanza NotFoundException al eliminar si la nota no existe en la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (notaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.eliminar(1, 999, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("elimina la nota físicamente", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (notaRepo.findOne as jest.Mock).mockResolvedValue(notaFixture());
    (notaRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });

    const result = await service.eliminar(1, 10, adminContext);

    expect(notaRepo.delete).toHaveBeenCalledWith({ id: 10 });
    expect(result).toEqual({ id: 10 });
  });
});