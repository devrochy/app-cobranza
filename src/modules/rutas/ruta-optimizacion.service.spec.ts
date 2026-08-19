import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { RutaOptimizadaLog } from "./ruta-optimizada-log.entity";
import { RutaOptimizacionService } from "./ruta-optimizacion.service";

describe("RutaOptimizacionService", () => {
  let service: RutaOptimizacionService;
  let rutaRepo: Repository<Ruta>;
  let logRepo: Repository<RutaOptimizadaLog>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    manager: { createQueryBuilder: jest.fn() },
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
        RutaOptimizacionService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaOptimizadaLog), useValue: mockLogRepo },
      ],
    }).compile();

    service = module.get(RutaOptimizacionService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    logRepo = module.get(getRepositoryToken(RutaOptimizadaLog));
  });

  it("lanza NotFoundException si la ruta no existe al generar", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.generar(999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede generar trayectos de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.generar(1, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("genera trayectos a partir de los clientes del día con deuda y persiste", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    // clientes del día (2 con deuda, 1 sin deuda excluido por la query).
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, latitud: -17.7, longitud: -63.1 },
        { clienteId: 2, latitud: -17.72, longitud: -63.12 },
        { clienteId: 3, latitud: -17.68, longitud: -63.09 },
      ]);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<RutaOptimizadaLog>) => e as RutaOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: RutaOptimizadaLog) => ({
      ...l,
      id: 10,
    }));

    const result = await service.generar(1, adminContext);

    expect(logRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ rutaId: 1, tipo: "planificada", recalculado: false }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
    expect(result[0].map((p) => p.clienteId).sort()).toEqual([1, 2, 3]);
  });

  it("genera trayectos vacíos y persiste si no hay clientes con deuda", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([]);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<RutaOptimizadaLog>) => e as RutaOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: RutaOptimizadaLog) => ({ ...l, id: 11 }));

    const result = await service.generar(1, adminContext);

    expect(result).toEqual([]);
    expect(logRepo.save).toHaveBeenCalled();
  });

  it("consultar devuelve el trayecto planificado del día", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (logRepo.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      rutaId: 1,
      tipo: "planificada",
      ordenClientesJson: [[{ clienteId: 1, latitud: -17.7, longitud: -63.1 }]],
      distanciaEstimadaKm: 5,
      tiempoEstimadoMin: 15,
    } as RutaOptimizadaLog);

    const result = await service.consultar(1, adminContext);

    expect(result).toMatchObject({ id: 10, tipo: "planificada" });
    expect(logRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ruta: { id: 1 }, tipo: "planificada" }) }),
    );
  });

  it("consultar lanza NotFoundException si no hay trayecto planificado del día", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (logRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.consultar(1, adminContext)).rejects.toThrow(NotFoundException);
  });
});