import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { PosicionCobrador } from "./posicion-cobrador.entity";
import { RutaOptimizadaLog } from "./ruta-optimizada-log.entity";
import { RutaOptimizacionService } from "./ruta-optimizacion.service";

describe("RutaOptimizacionService", () => {
  let service: RutaOptimizacionService;
  let rutaRepo: Repository<Ruta>;
  let logRepo: Repository<RutaOptimizadaLog>;
  let posicionRepo: Repository<PosicionCobrador>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };
  const cobradorContext = { rol: "cobrador" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    manager: { createQueryBuilder: jest.fn() },
  };
  const mockPosicionRepo = { findOne: jest.fn().mockResolvedValue(null) };

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
        { provide: getRepositoryToken(PosicionCobrador), useValue: mockPosicionRepo },
      ],
    }).compile();

    service = module.get(RutaOptimizacionService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    logRepo = module.get(getRepositoryToken(RutaOptimizadaLog));
    posicionRepo = module.get(getRepositoryToken(PosicionCobrador));
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

  it("obtenerClientesDelDia filtra por la regla de cobro de HOY (vencimiento hoy / mora / promesa) y exige coordenadas", async () => {
    const { qb, calls } = fakeQueryBuilder();
    qb.getRawMany.mockResolvedValue([
      { clienteId: "1", latitud: "-17.7", longitud: "-63.1" },
      { clienteId: "2", latitud: "-17.72", longitud: "-63.12" },
    ]);
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (logRepo.manager.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<RutaOptimizadaLog>) => e as RutaOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: RutaOptimizadaLog) => ({ ...l, id: 12 }));

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

  it("generar parte de la última posición registrada del cobrador", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, latitud: -17.7, longitud: -63.1 },
        { clienteId: 2, latitud: -17.71, longitud: -63.11 },
        { clienteId: 3, latitud: -17.69, longitud: -63.09 },
      ]);
    // La última posición del cobrador está junto al cliente 3.
    (posicionRepo.findOne as jest.Mock).mockResolvedValue({
      latitud: -17.6901,
      longitud: -63.0901,
    } as PosicionCobrador);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<RutaOptimizadaLog>) => e as RutaOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: RutaOptimizadaLog) => ({ ...l, id: 13 }));

    const result = await service.generar(1, cobradorContext);

    // Consulta la posición del cobrador de la ruta (no requester.sub genérico).
    expect(posicionRepo.findOne).toHaveBeenCalledWith({
      where: { cobradorId: rutaFixture().cobradorId, rutaId: 1 },
    });
    // La primera parada es la más cercana a esa posición (no el ancla determinista #2).
    expect(result[0][0].clienteId).toBe(3);
  });

  it("generar sin posición registrada mantiene el ancla determinista", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, latitud: -17.7, longitud: -63.1 },
        { clienteId: 2, latitud: -17.71, longitud: -63.11 },
        { clienteId: 3, latitud: -17.69, longitud: -63.09 },
      ]);
    (posicionRepo.findOne as jest.Mock).mockResolvedValue(null);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<RutaOptimizadaLog>) => e as RutaOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: RutaOptimizadaLog) => ({ ...l, id: 14 }));

    const result = await service.generar(1, cobradorContext);

    // Sin posición conocida: primer destino = menor latitud+longitud (cliente 2).
    expect(result[0][0].clienteId).toBe(2);
  });

  it("sin cobrador asignado a la ruta y requester no cobrador, genera sin consultar posición", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(
      rutaFixture({ cobradorId: undefined as unknown as number }),
    );
    (service as unknown as { obtenerClientesDelDia: jest.Mock }).obtenerClientesDelDia = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, latitud: -17.7, longitud: -63.1 },
        { clienteId: 2, latitud: -17.71, longitud: -63.11 },
        { clienteId: 3, latitud: -17.69, longitud: -63.09 },
      ]);
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<RutaOptimizadaLog>) => e as RutaOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: RutaOptimizadaLog) => ({ ...l, id: 15 }));

    const result = await service.generar(1, adminContext);

    // Sin cobrador ni requester cobrador: inicio = undefined, no se consulta posición.
    expect(posicionRepo.findOne).not.toHaveBeenCalled();
    expect(result[0][0].clienteId).toBe(2);
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