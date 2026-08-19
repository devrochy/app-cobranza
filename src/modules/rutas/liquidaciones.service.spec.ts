import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Caja } from "./caja.entity";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { Liquidacion } from "./liquidacion.entity";
import { LiquidacionesService } from "./liquidaciones.service";

describe("LiquidacionesService", () => {
  let service: LiquidacionesService;
  let rutaRepo: Repository<Ruta>;
  let configRepo: Repository<RutaConfig>;
  let cajaRepo: Repository<Caja>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockCajaRepo = { findOne: jest.fn() };

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

  function configFixture(overrides: Partial<RutaConfig> = {}): RutaConfig {
    return {
      id: 1,
      rutaId: 1,
      cuotasMinimasPrestamo: 1,
      cuotasAtrasoUmbral: 1,
      manejoCupoActivo: false,
      cupoDefault: 0,
      recargoActivo: false,
      bloquearCambioInteres: false,
      comisionActiva: true,
      comisionPorcentaje: 10,
      mostrarFechaUltimaLiquidada: false,
      mostrarCaja: false,
      mostrarCobradoLiquidada: false,
      mostrarPrestamos: false,
      eliminarPrestamosApk: false,
      reconocimientoFacialActivo: false,
      registroDocumentoCliente: false,
      eliminarPagosApk: false,
      eliminarGastosApk: false,
      eliminarInyeccionApk: false,
      eliminarAbonosApk: false,
      registrarInyeccionApk: false,
      generarReportesApk: false,
      ocultarCartera: false,
      mostrarCobroEstimado: false,
      bloqueoAutomaticoClientes: false,
      permitirCambioFechaPrestamo: false,
      borrarClientesSinDeuda: false,
      diasNoLaborables: "solo_domingos",
      periodoLiquidacion: "diario",
      ...overrides,
    } as RutaConfig;
  }

  function cajaFixture(overrides: Partial<Caja> = {}): Caja {
    return {
      id: 1,
      rutaId: 1,
      saldoInicial: 1000,
      saldoActual: 1500,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as Caja;
  }

  function liquidacionFixture(overrides: Partial<Liquidacion> = {}): Liquidacion {
    return {
      id: 1,
      rutaId: 1,
      fecha: "2026-08-18",
      periodo: "diario",
      cajaAnterior: 1000,
      cajaActual: 1300,
      estimadoACobrar: 0,
      totalInyeccion: 0,
      totalCobradoPeriodo: 300,
      totalCobradoDia: 300,
      totalPrestado: 0,
      totalGastos: 0,
      sumaCartera: 0,
      comisionPorcentaje: 10,
      comisionValor: 30,
      comentario: null,
      createdAt: new Date(),
      ...overrides,
    } as Liquidacion;
  }

  function qbMock(result: unknown) {
    return {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(result),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
  }

  // Simula una transacción: ejecuta la función con un manager que delega a los mocks.
  function makeManager(qbs: unknown[]) {
    const managerLiquidacionRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const managerCajaRepo = { findOne: jest.fn() };
    const qbCalls: jest.Mock[] = [];
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Liquidacion) return managerLiquidacionRepo;
        if (entity === Caja) return managerCajaRepo;
        return {};
      }),
      createQueryBuilder: jest.fn(() => {
        const qb = (qbs[qbCalls.length] ?? qbMock({ total: 0 })) as jest.Mock;
        qbCalls.push(qb);
        return qb;
      }),
    };
    return { manager, managerLiquidacionRepo, managerCajaRepo };
  }

  function makeDataSource(qbs: unknown[], ultima: Liquidacion | null, cajaActual: Caja) {
    return {
      transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
        const ctx = makeManager(qbs);
        ctx.managerLiquidacionRepo.findOne.mockResolvedValue(ultima);
        ctx.managerCajaRepo.findOne.mockResolvedValue(cajaActual);
        ctx.managerLiquidacionRepo.create.mockImplementation((e: Partial<Liquidacion>) => e as Liquidacion);
        ctx.managerLiquidacionRepo.save.mockImplementation(async (l: Liquidacion) =>
          liquidacionFixture({ ...l, id: 10 }),
        );
        return fn(ctx.manager);
      }),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidacionesService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
        { provide: DataSource, useValue: makeDataSource([], null, cajaFixture()) },
      ],
    }).compile();

    service = module.get(LiquidacionesService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    configRepo = module.get(getRepositoryToken(RutaConfig));
    cajaRepo = module.get(getRepositoryToken(Caja));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.generar(999, {}, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede liquidar una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.generar(1, {}, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("lanza ConflictException si ya existe liquidación del periodo vigente", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 18, 12, 0, 0));
    try {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture());
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(cajaFixture());
      // DataSource cuyo manager devuelve una última liquidación en la ventana.
      const module = await Test.createTestingModule({
        providers: [
          LiquidacionesService,
          { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
          { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
          { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
          { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
          { provide: DataSource, useValue: makeDataSource([], liquidacionFixture(), cajaFixture()) },
        ],
      }).compile();
      const srv = module.get(LiquidacionesService);

      await expect(srv.generar(1, {}, adminContext)).rejects.toThrow(ConflictException);
    } finally {
      jest.useRealTimers();
    }
  });

  it("filtra estimado_a_cobrar por fecha_vencimiento dentro de la ventana", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture());
    (cajaRepo.findOne as jest.Mock).mockResolvedValue(cajaFixture());

    const qbs = [
      qbMock({ total: 1000 }), // cuotas pendientes (estimado)
      qbMock({ total: 0 }), // abonos
      qbMock({ total: 200 }), // pagos periodo
      qbMock({ total: 200 }), // pagos dia
      qbMock({ total: 500 }), // prestamos
      qbMock({ total: 50 }), // gastos aprobados
      qbMock({ total: 300 }), // inyecciones activas
    ];
    const ds = makeDataSource(qbs, null, cajaFixture());
    const module = await Test.createTestingModule({
      providers: [
        LiquidacionesService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
        { provide: DataSource, useValue: ds },
      ],
    }).compile();
    const srv = module.get(LiquidacionesService);

    await srv.generar(1, {}, adminContext);

    // La 1ª agregación (cuotas pendientes) debe aplicar los 2 filtros de fecha_vencimiento.
    const cuotasQb = qbs[0] as ReturnType<typeof qbMock>;
    const andWhereCalls = (cuotasQb.andWhere as jest.Mock).mock.calls.map((c) => c[0]);
    expect(andWhereCalls).toContain("c.fecha_vencimiento >= :inicio");
    expect(andWhereCalls).toContain("c.fecha_vencimiento <= :fin");
  });

  it("genera la liquidación con los cálculos y snapshot persistido", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture());
    (cajaRepo.findOne as jest.Mock).mockResolvedValue(cajaFixture());

    const qbs = [
      qbMock({ total: 1000 }), // estimado/cartera (cuotas)
      qbMock({ total: 0 }), // abonos
      qbMock({ total: 200 }), // pagos periodo
      qbMock({ total: 200 }), // pagos dia
      qbMock({ total: 500 }), // prestamos
      qbMock({ total: 50 }), // gastos aprobados
      qbMock({ total: 300 }), // inyecciones activas
    ];
    const ds = makeDataSource(qbs, null, cajaFixture());
    const module = await Test.createTestingModule({
      providers: [
        LiquidacionesService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
        { provide: DataSource, useValue: ds },
      ],
    }).compile();
    const srv = module.get(LiquidacionesService);

    const result = await srv.generar(1, { comentario: "cierre" }, adminContext);

    // Verificar el objeto persistido vía el create del manager de la transacción.
    // Se accede a través del transaction mock para inspeccionar la llamada.
    const transactionFn = ds.transaction.mock.calls[0][0] as (m: unknown) => Promise<unknown>;
    // Re-ejecutar capturando el manager
    let createdPayload: unknown;
    const ctx = makeManager(qbs);
    ctx.managerLiquidacionRepo.create.mockImplementation((e: Partial<Liquidacion>) => {
      createdPayload = e;
      return e as Liquidacion;
    });
    ctx.managerLiquidacionRepo.save.mockImplementation(async (l: Liquidacion) =>
      liquidacionFixture({ ...l, id: 10 }),
    );
    ctx.managerLiquidacionRepo.findOne.mockResolvedValue(null);
    ctx.managerCajaRepo.findOne.mockResolvedValue(cajaFixture());
    await transactionFn(ctx.manager);

    expect(createdPayload).toMatchObject({
      rutaId: 1,
      cajaAnterior: 1000,
      cajaActual: 1500,
      totalInyeccion: 300,
      totalCobradoPeriodo: 200,
      totalCobradoDia: 200,
      totalPrestado: 500,
      totalGastos: 50,
      comisionPorcentaje: 10,
      comisionValor: 20, // 200 * 10%
      comentario: "cierre",
    });
    expect(result.id).toBe(10);
  });

  it("usa saldoInicial como caja_anterior si no hay liquidación previa", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture());
    (cajaRepo.findOne as jest.Mock).mockResolvedValue(cajaFixture());

    const qbs = [
      qbMock({ total: 0 }),
      qbMock({ total: 0 }),
      qbMock({ total: 0 }),
      qbMock({ total: 0 }),
      qbMock({ total: 0 }),
      qbMock({ total: 0 }),
      qbMock({ total: 0 }),
    ];
    const ds = makeDataSource(qbs, null, cajaFixture());
    const module = await Test.createTestingModule({
      providers: [
        LiquidacionesService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
        { provide: DataSource, useValue: ds },
      ],
    }).compile();
    const srv = module.get(LiquidacionesService);

    await srv.generar(1, {}, adminContext);

    const ctx = makeManager([]);
    ctx.managerLiquidacionRepo.findOne.mockResolvedValue(null);
    ctx.managerCajaRepo.findOne.mockResolvedValue(cajaFixture());
    const transactionFn = ds.transaction.mock.calls[0][0] as (m: unknown) => Promise<unknown>;
    let createdPayload: unknown;
    ctx.managerLiquidacionRepo.create.mockImplementation((e: Partial<Liquidacion>) => {
      createdPayload = e;
      return e as Liquidacion;
    });
    ctx.managerLiquidacionRepo.save.mockImplementation(async (l: Liquidacion) =>
      liquidacionFixture({ ...l, id: 11 }),
    );
    await transactionFn(ctx.manager);

    expect(createdPayload).toMatchObject({ cajaAnterior: 1000, cajaActual: 1500 });
  });
});

describe("LiquidacionesService - historial y exportación", () => {
  let service: LiquidacionesService;
  let rutaRepo: Repository<Ruta>;
  let liquidacionRepo: Repository<Liquidacion>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockCajaRepo = { findOne: jest.fn() };
  const mockLiquidacionRepo = { findOne: jest.fn(), find: jest.fn() };

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

  function liquidacionFixture(overrides: Partial<Liquidacion> = {}): Liquidacion {
    return {
      id: 10,
      rutaId: 1,
      fecha: "2026-08-19",
      periodo: "diario",
      cajaAnterior: 1000,
      cajaActual: 1500,
      estimadoACobrar: 2000,
      totalInyeccion: 300,
      totalCobradoPeriodo: 200,
      totalCobradoDia: 200,
      totalPrestado: 500,
      totalGastos: 50,
      sumaCartera: 1000,
      comisionPorcentaje: 10,
      comisionValor: 20,
      comentario: "cierre",
      createdAt: new Date(),
      ...overrides,
    } as Liquidacion;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidacionesService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: mockLiquidacionRepo },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get(LiquidacionesService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    liquidacionRepo = module.get(getRepositoryToken(Liquidacion));
  });

  it("listar lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.listar(999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("listar devuelve las liquidaciones de la ruta ordenadas por fecha DESC", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (liquidacionRepo.find as jest.Mock).mockResolvedValue([
      liquidacionFixture({ id: 2, fecha: "2026-08-20" }),
      liquidacionFixture({ id: 1, fecha: "2026-08-19" }),
    ]);

    const result = await service.listar(1, adminContext);

    expect(liquidacionRepo.find).toHaveBeenCalledWith({
      where: { ruta: { id: 1 } },
      order: { fecha: "DESC" },
    });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2);
  });

  it("un socio no puede listar una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.listar(1, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("exportar lanza NotFoundException si la liquidación no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (liquidacionRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.exportar(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("exportar genera un buffer xlsx a partir de la liquidación", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (liquidacionRepo.findOne as jest.Mock).mockResolvedValue(liquidacionFixture());

    const { buffer, filename } = await service.exportar(1, 10, adminContext);
    expect(filename).toBe("liquidacion-2026-08-19.xlsx");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // El buffer xlsx debe iniciar con la firma PK (ZIP de OOXML).
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");

    // Valida el contenido del xlsx parseándolo con el propio exceljs.
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const hoja = workbook.getWorksheet("Liquidación");
    expect(hoja).toBeDefined();
    const filaComision = hoja?.getRow(15).getCell(1).value;
    expect(String(filaComision)).toContain("Comisión valor");
  }, 20000);

  it("un socio no puede exportar una liquidación de ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.exportar(1, 10, socioContext)).rejects.toThrow(ForbiddenException);
  });
});