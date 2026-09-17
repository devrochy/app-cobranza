import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cartera } from "./cartera.entity";
import { PosicionGestor } from "./posicion-gestor.entity";
import { CarteraOptimizadaLog } from "./cartera-optimizada-log.entity";
import { CarteraOptimizacionService } from "./cartera-optimizacion.service";

describe("CarteraOptimizacionService", () => {
  let service: CarteraOptimizacionService;
  let carteraRepo: Repository<Cartera>;
  let logRepo: Repository<CarteraOptimizadaLog>;
  let posicionRepo: Repository<PosicionGestor>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };
  const gestorContext = { rol: "gestor" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    manager: { createQueryBuilder: jest.fn() },
  };
  const mockPosicionRepo = { findOne: jest.fn().mockResolvedValue(null) };

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarteraOptimizacionService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(CarteraOptimizadaLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(PosicionGestor), useValue: mockPosicionRepo },
      ],
    }).compile();

    service = module.get(CarteraOptimizacionService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    logRepo = module.get(getRepositoryToken(CarteraOptimizadaLog));
    posicionRepo = module.get(getRepositoryToken(PosicionGestor));
  });

  function fakeQueryBuilder() {
    const calls: string[] = [];
    const methods = [
      "select",
      "addSelect",
      "from",
      "innerJoin",
      "leftJoin",
      "where",
      "andWhere",
      "groupBy",
      "having",
      "setParameter",
    ] as const;
    const qb: Record<string, jest.Mock> = {};
    for (const m of methods) {
      qb[m] = jest.fn(function (this: Record<string, jest.Mock>, ...args: unknown[]) {
        calls.push(`${m}: ${args.join(" | ")}`);
        return this;
      });
    }
    qb.getRawMany = jest.fn();
    return { qb, calls };
  }

  it("lanza NotFoundException si la cartera no existe al generar", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.generar(999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede generar trayectos de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(service.generar(1, propietarioContext)).rejects.toThrow(ForbiddenException);
  });

  it("genera trayectos a partir de los clientes del día con deuda y persiste", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    // clientes del día (2 con deuda, 1 sin deuda excluido por la query).
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, latitud: -17.7, longitud: -63.1 },
        { clienteId: 2, latitud: -17.72, longitud: -63.12 },
        { clienteId: 3, latitud: -17.68, longitud: -63.09 },
      ]);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraOptimizadaLog>) => e as CarteraOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: CarteraOptimizadaLog) => ({
      ...l,
      id: 10,
    }));

    const result = await service.generar(1, adminContext);

    expect(logRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ carteraId: 1, tipo: "planificada", recalculado: false }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
    expect(result[0].map((p) => p.clienteId).sort()).toEqual([1, 2, 3]);
  });

  it("genera trayectos vacíos y persiste si no hay clientes con deuda", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([]);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraOptimizadaLog>) => e as CarteraOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: CarteraOptimizadaLog) => ({ ...l, id: 11 }));

    const result = await service.generar(1, adminContext);

    expect(result).toEqual([]);
    expect(logRepo.save).toHaveBeenCalled();
  });

  it("obtenerClientesDelDia filtra por la regla de cobro de HOY (vencimiento hoy / mora / promesa) y exige coordenadas", async () => {
    const { qb, calls } = fakeQueryBuilder();
    qb.getRawMany.mockResolvedValue([
      { clienteId: "1", latitud: "-17.7", longitud: "-63.1" },
      { clienteId: "2", latitud: "-17.72", longitud: "-63.12" },
    ]);
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (logRepo.manager.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraOptimizadaLog>) => e as CarteraOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: CarteraOptimizadaLog) => ({ ...l, id: 12 }));

    const result = await service.generar(1, adminContext);
    expect(result[0].map((p) => p.clienteId).sort()).toEqual([1, 2]);

    // Solo préstamos vigentes y cuotas de esos préstamos (join), con coordenadas obligatorias.
    const innerJoin = calls.find((c) => c.startsWith("innerJoin")) ?? "";
    expect(innerJoin).toContain("p.estatus = 'vigente'");
    expect(calls.some((c) => c.startsWith("leftJoin"))).toBe(true);
    expect(calls.some((c) => c.includes("c.ubicacion IS NOT NULL"))).toBe(true);

    // La regla de "cobro HOY" (misma que la lista del día):
    //  1) cuota que vence HOY, 2) cuota en mora, 3) compromiso de pago prometido HOY.
    const having = calls.find((c) => c.startsWith("having")) ?? "";
    expect(having).toContain("cu.fecha_vencimiento = :hoy");
    expect(having).toContain("fecha_vencimiento < :hoy");
    expect(having).toContain("pr.fecha_prometida = :hoy");
  });

  it("generar parte de la última posición registrada del gestor", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, latitud: -17.7, longitud: -63.1 },
        { clienteId: 2, latitud: -17.71, longitud: -63.11 },
        { clienteId: 3, latitud: -17.69, longitud: -63.09 },
      ]);
    // La última posición del gestor está junto al cliente 3.
    (posicionRepo.findOne as jest.Mock).mockResolvedValue({
      latitud: -17.6901,
      longitud: -63.0901,
    } as PosicionGestor);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraOptimizadaLog>) => e as CarteraOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: CarteraOptimizadaLog) => ({ ...l, id: 13 }));

    const result = await service.generar(1, gestorContext);

    // Consulta la posición del gestor de la cartera (no requester.sub genérico).
    expect(posicionRepo.findOne).toHaveBeenCalledWith({
      where: { gestorId: carteraFixture().gestorId, carteraId: 1 },
    });
    // La primera parada es la más cercana a esa posición (no el ancla determinista #2).
    expect(result[0][0].clienteId).toBe(3);
  });

  it("generar sin posición registrada mantiene el ancla determinista", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, latitud: -17.7, longitud: -63.1 },
        { clienteId: 2, latitud: -17.71, longitud: -63.11 },
        { clienteId: 3, latitud: -17.69, longitud: -63.09 },
      ]);
    (posicionRepo.findOne as jest.Mock).mockResolvedValue(null);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraOptimizadaLog>) => e as CarteraOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: CarteraOptimizadaLog) => ({ ...l, id: 14 }));

    const result = await service.generar(1, gestorContext);

    // Sin posición conocida: primer destino = menor latitud+longitud (cliente 2).
    expect(result[0][0].clienteId).toBe(2);
  });

  it("sin gestor asignado a la cartera y requester no gestor, genera sin consultar posición", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(
      carteraFixture({ gestorId: undefined as unknown as number }),
    );
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, latitud: -17.7, longitud: -63.1 },
        { clienteId: 2, latitud: -17.71, longitud: -63.11 },
        { clienteId: 3, latitud: -17.69, longitud: -63.09 },
      ]);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraOptimizadaLog>) => e as CarteraOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: CarteraOptimizadaLog) => ({ ...l, id: 15 }));

    const result = await service.generar(1, adminContext);

    // Sin gestor ni requester gestor: inicio = undefined, no se consulta posición.
    expect(posicionRepo.findOne).not.toHaveBeenCalled();
    expect(result[0][0].clienteId).toBe(2);
  });

  it("consultar devuelve el trayecto planificado del día", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (logRepo.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      carteraId: 1,
      tipo: "planificada",
      ordenClientesJson: [[{ clienteId: 1, latitud: -17.7, longitud: -63.1 }]],
      distanciaEstimadaKm: 5,
      tiempoEstimadoMin: 15,
    } as CarteraOptimizadaLog);

    const result = await service.consultar(1, adminContext);

    expect(result).toMatchObject({ id: 10, tipo: "planificada" });
    expect(logRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cartera: { id: 1 }, tipo: "planificada" }) }),
    );
  });

  it("consultar lanza NotFoundException si no hay trayecto planificado del día", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (logRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.consultar(1, adminContext)).rejects.toThrow(NotFoundException);
  });
});