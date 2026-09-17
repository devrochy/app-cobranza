import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cartera } from "./cartera.entity";
import { CarteraOptimizadaLog } from "./cartera-optimizada-log.entity";
import { ReporteDiario } from "./reporte-diario.entity";
import { ReportesDiariosService } from "./reportes-diarios.service";
import { TrayectoriasService } from "./trayectorias.service";

describe("TrayectoriasService", () => {
  let service: TrayectoriasService;
  let carteraRepo: Repository<Cartera>;
  let logRepo: Repository<CarteraOptimizadaLog>;
  let reporteRepo: Repository<ReporteDiario>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockLogRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
  const mockReporteRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        getRepository: jest.fn((entity: unknown) => {
          if (entity === CarteraOptimizadaLog) return mockLogRepo;
          if (entity === ReporteDiario) return mockReporteRepo;
          return mockCarteraRepo;
        }),
      }),
    ),
  };

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
        TrayectoriasService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(CarteraOptimizadaLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(ReporteDiario), useValue: mockReporteRepo },
        { provide: ReportesDiariosService, useValue: { computarCampos: jest.fn().mockResolvedValue({}) } },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(TrayectoriasService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    logRepo = module.get(getRepositoryToken(CarteraOptimizadaLog));
    reporteRepo = module.get(getRepositoryToken(ReporteDiario));
  });

  it("lanza NotFoundException si la cartera no existe al registrar real", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrarReal(999, [{ latitud: -17.78, longitud: -63.18 }], adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede registrar la trayectoria real de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(
      service.registrarReal(1, [{ latitud: -17.78, longitud: -63.18 }], propietarioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("registra la trayectoria real como tipo 'real' con GeoJSON", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraOptimizadaLog>) => e as CarteraOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: CarteraOptimizadaLog) => ({ ...l, id: 20 }));
    (logRepo.findOne as jest.Mock).mockResolvedValue(null);
    (reporteRepo.findOne as jest.Mock).mockResolvedValue(null);
    (reporteRepo.create as jest.Mock).mockImplementation((e: Partial<ReporteDiario>) => e as ReporteDiario);
    (reporteRepo.save as jest.Mock).mockImplementation(async (r: ReporteDiario) => ({ ...r, id: 5 }));

    await service.registrarReal(
      1,
      [
        { latitud: -17.78, longitud: -63.18 },
        { latitud: -17.79, longitud: -63.19 },
      ],
      adminContext,
    );

    expect(logRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ carteraId: 1, tipo: "real", recalculado: false }),
    );
    const payload = (logRepo.create as jest.Mock).mock.calls[0][0] as Partial<CarteraOptimizadaLog>;
    expect(payload.waypointsGeojson).toBeDefined();
  });

  it("consulta devuelve el reporte del día con trayectorias planificada y real", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    // planificada existe.
    (logRepo.findOne as jest.Mock).mockImplementation((opts) => {
      if (opts.where?.tipo === "planificada") {
        return Promise.resolve({ tipo: "planificada", waypointsGeojson: [] } as CarteraOptimizadaLog);
      }
      return Promise.resolve({ tipo: "real", waypointsGeojson: [] } as CarteraOptimizadaLog);
    });
    (reporteRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      carteraId: 1,
      fecha: "2026-08-19",
      trayectoriasJson: { type: "FeatureCollection", features: [] },
    } as ReporteDiario);

    const result = await service.consultar(1, adminContext);

    expect(result.trayectoriasJson).toBeDefined();
    expect(result.fecha).toBe("2026-08-19");
  });

  it("consulta lanza NotFoundException si no hay reporte del día", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (reporteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.consultar(1, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("generarReporteDiario consolida features de planificada y real con su origen", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    // Planificada guarda orden_clientes_json como Trayecto[][] plano (HU-55).
    (logRepo.findOne as jest.Mock).mockImplementation((opts) => {
      if (opts.where?.tipo === "planificada") {
        return Promise.resolve({
          tipo: "planificada",
          ordenClientesJson: [[{ latitud: -17.78, longitud: -63.18 }]],
          waypointsGeojson: [],
        } as CarteraOptimizadaLog);
      }
      return Promise.resolve({
        tipo: "real",
        ordenClientesJson: [
          { latitud: -17.79, longitud: -63.19 },
          { latitud: -17.8, longitud: -63.2 },
        ],
        waypointsGeojson: [],
      } as CarteraOptimizadaLog);
    });
    (reporteRepo.findOne as jest.Mock).mockResolvedValue(null);
    (reporteRepo.create as jest.Mock).mockImplementation((e: Partial<ReporteDiario>) => e as ReporteDiario);
    (reporteRepo.save as jest.Mock).mockImplementation(async (r: ReporteDiario) => ({ ...r, id: 5 }));

    const result = await service.generarReporteDiario(1, adminContext);

    const fc = result.trayectoriasJson as { type: string; features: Array<{ properties: Record<string, unknown> }> };
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(2);
    const origenes = fc.features.map((f) => f.properties.origen);
    expect(origenes).toContain("planificada");
    expect(origenes).toContain("real");
  });

  it("registrarReal persiste el log y el reporte dentro de una transacción", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraOptimizadaLog>) => e as CarteraOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: CarteraOptimizadaLog) => ({ ...l, id: 20 }));
    (logRepo.findOne as jest.Mock).mockResolvedValue(null);
    (reporteRepo.findOne as jest.Mock).mockResolvedValue(null);
    (reporteRepo.create as jest.Mock).mockImplementation((e: Partial<ReporteDiario>) => e as ReporteDiario);
    (reporteRepo.save as jest.Mock).mockImplementation(async (r: ReporteDiario) => ({ ...r, id: 5 }));

    await service.registrarReal(1, [{ latitud: -17.78, longitud: -63.18 }], adminContext);

    expect(mockDataSource.transaction).toHaveBeenCalled();
  });

  it("generarReporteDiario consulta los logs de la fecha del reporte", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (logRepo.findOne as jest.Mock).mockResolvedValue(null);
    (reporteRepo.findOne as jest.Mock).mockResolvedValue(null);
    (reporteRepo.create as jest.Mock).mockImplementation((e: Partial<ReporteDiario>) => e as ReporteDiario);
    (reporteRepo.save as jest.Mock).mockImplementation(async (r: ReporteDiario) => ({ ...r, id: 5 }));

    await service.generarReporteDiario(1, adminContext);

    expect(logRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fecha: expect.any(String) }),
      }),
    );
  });
});