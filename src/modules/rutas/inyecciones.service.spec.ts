import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { Inyeccion } from "./inyeccion.entity";
import { CreateInyeccionInput, InyeccionesService } from "./inyecciones.service";
import { CajaService } from "./caja.service";

describe("InyeccionesService", () => {
  let service: InyeccionesService;
  let rutaRepo: Repository<Ruta>;
  let inyRepo: Repository<Inyeccion>;

  const baseInput: CreateInyeccionInput = {
    valor: 1500,
    comentario: "Aporte semanal",
  };

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockInyRepo = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockCajaService = {
    aplicarMovimiento: jest.fn(async () => ({
      rutaId: 1,
      saldoInicial: 1000,
      saldoActual: 2500,
    })),
  };

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InyeccionesService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Inyeccion), useValue: mockInyRepo },
        { provide: CajaService, useValue: mockCajaService },
      ],
    }).compile();

    service = module.get(InyeccionesService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    inyRepo = module.get(getRepositoryToken(Inyeccion));
  });

  it("persiste la inyección con estado activa y fechaHora", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const fecha = new Date();
    (inyRepo.create as jest.Mock).mockImplementation((e: Partial<Inyeccion>) => ({
      ...e,
      fechaHora: fecha,
    }) as Inyeccion);
    (inyRepo.save as jest.Mock).mockImplementation(async (e: Partial<Inyeccion>) => ({
      id: 1,
      rutaId: 1,
      ...e,
      fechaHora: fecha,
    }) as Inyeccion);

    const result = await service.crear(1, baseInput, adminContext);

    expect(inyRepo.save).toHaveBeenCalledTimes(1);
    expect(result.valor).toBe(1500);
    expect(result.comentario).toBe("Aporte semanal");
    expect(result.estado).toBe("activa");
    expect(result.fechaHora).toEqual(fecha);
    expect(result.rutaId).toBe(1);
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.crear(999, baseInput, adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("un socio no puede registrar una inyección en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.crear(1, baseInput, socioContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("un socio puede registrar en su propia ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (inyRepo.create as jest.Mock).mockImplementation((e: Partial<Inyeccion>) => e as Inyeccion);
    (inyRepo.save as jest.Mock).mockImplementation(async (e: Partial<Inyeccion>) => ({
      id: 1,
      rutaId: 1,
      fechaHora: new Date(),
      ...e,
    }) as Inyeccion);

    const result = await service.crear(1, baseInput, socioContext);

    expect(result.rutaId).toBe(1);
  });

  it("al crear una inyección aumenta la caja de la ruta (wiring HU-11)", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (inyRepo.create as jest.Mock).mockImplementation((e: Partial<Inyeccion>) => e as Inyeccion);
    (inyRepo.save as jest.Mock).mockImplementation(async (e: Partial<Inyeccion>) => ({
      id: 1,
      rutaId: 1,
      fechaHora: new Date(),
      ...e,
    }) as Inyeccion);

    await service.crear(1, baseInput, adminContext);

    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
      1,
      1500,
      "inyeccion",
      { rol: "admin", sub: 0 },
      "Aporte semanal",
    );
  });

  describe("eliminar", () => {
    function inyeccionActual(overrides: Partial<Inyeccion> = {}): Inyeccion {
      return {
        id: 10,
        rutaId: 1,
        valor: 1500,
        comentario: "Aporte",
        fechaHora: new Date("2026-08-12T10:00:00Z"),
        estado: "activa",
        ...overrides,
      } as Inyeccion;
    }

    it("cambia el estado a eliminada conservando la fechaHora", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      const actual = inyeccionActual();
      (inyRepo.findOne as jest.Mock).mockResolvedValue(actual);
      (inyRepo.save as jest.Mock).mockImplementation(async (e: Partial<Inyeccion>) => ({
        ...actual,
        ...e,
      }) as Inyeccion);

      const result = await service.eliminar(1, 10, adminContext);

      expect(inyRepo.save).toHaveBeenCalled();
      expect(result.estado).toBe("eliminada");
      expect(result.fechaHora).toEqual(actual.fechaHora);
    });

    it("es idempotente si la inyección ya estaba eliminada", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      const actual = inyeccionActual({ estado: "eliminada" });
      (inyRepo.findOne as jest.Mock).mockResolvedValue(actual);
      (inyRepo.save as jest.Mock).mockImplementation(async (e: Partial<Inyeccion>) => ({
        ...actual,
        ...e,
      }) as Inyeccion);

      const result = await service.eliminar(1, 10, adminContext);

      expect(result.estado).toBe("eliminada");
    });

    it("al eliminar una inyección activa disminuye la caja (wiring HU-12)", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      const actual = inyeccionActual({ estado: "activa" });
      (inyRepo.findOne as jest.Mock).mockResolvedValue(actual);
      (inyRepo.save as jest.Mock).mockImplementation(async (e: Partial<Inyeccion>) => ({
        ...actual,
        ...e,
      }) as Inyeccion);

      await service.eliminar(1, 10, adminContext);

      expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
        1,
        -1500,
        "inyeccion_eliminada",
        { rol: "admin", sub: 0 },
        "Aporte",
      );
    });

    it("no revierte la caja si la inyección ya estaba eliminada", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      const actual = inyeccionActual({ estado: "eliminada" });
      (inyRepo.findOne as jest.Mock).mockResolvedValue(actual);
      (inyRepo.save as jest.Mock).mockImplementation(async (e: Partial<Inyeccion>) => ({
        ...actual,
        ...e,
      }) as Inyeccion);

      await service.eliminar(1, 10, adminContext);

      expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
    });

    it("lanza NotFoundException si la ruta no existe", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.eliminar(999, 10, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza NotFoundException si la inyección no existe o es de otra ruta", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (inyRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.eliminar(1, 999, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("un socio no puede eliminar una inyección de una ruta ajena -> 403", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

      await expect(service.eliminar(1, 10, socioContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("listar", () => {
    it("lista solo las inyecciones activas DESC", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (inyRepo.find as jest.Mock).mockResolvedValue([
        {
          id: 1,
          rutaId: 1,
          valor: 1500,
          comentario: "Aporte",
          fechaHora: new Date("2026-08-12T10:00:00Z"),
          estado: "activa",
        },
      ]);

      const result = await service.listar(1, adminContext);

      expect(inyRepo.find).toHaveBeenCalledWith({
        where: { ruta: { id: 1 }, estado: "activa" },
        order: { fechaHora: "DESC" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].comentario).toBe("Aporte");
    });

    it("lanza NotFoundException al listar si la ruta no existe", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.listar(999, adminContext)).rejects.toThrow(NotFoundException);
    });

    it("un socio no puede listar inyecciones de una ruta ajena -> 403", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

      await expect(service.listar(1, socioContext)).rejects.toThrow(ForbiddenException);
    });
  });
});
