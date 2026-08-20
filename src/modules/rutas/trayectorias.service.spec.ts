import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { RutaOptimizadaLog } from "./ruta-optimizada-log.entity";
import { ReporteDiario } from "./reporte-diario.entity";
import { TrayectoriasService } from "./trayectorias.service";

describe("TrayectoriasService", () => {
  let service: TrayectoriasService;
  let rutaRepo: Repository<Ruta>;
  let logRepo: Repository<RutaOptimizadaLog>;
  let reporteRepo: Repository<ReporteDiario>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockLogRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
  const mockReporteRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };

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
        TrayectoriasService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaOptimizadaLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(ReporteDiario), useValue: mockReporteRepo },
      ],
    }).compile();

    service = module.get(TrayectoriasService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    logRepo = module.get(getRepositoryToken(RutaOptimizadaLog));
    reporteRepo = module.get(getRepositoryToken(ReporteDiario));
  });

  it("lanza NotFoundException si la ruta no existe al registrar real", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrarReal(999, [{ latitud: -17.78, longitud: -63.18 }], adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede registrar la trayectoria real de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.registrarReal(1, [{ latitud: -17.78, longitud: -63.18 }], socioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("registra la trayectoria real como tipo 'real' con GeoJSON", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (logRepo.create as jest.Mock).mockImplementation((e: Partial<RutaOptimizadaLog>) => e as RutaOptimizadaLog);
    (logRepo.save as jest.Mock).mockImplementation(async (l: RutaOptimizadaLog) => ({ ...l, id: 20 }));
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
      expect.objectContaining({ rutaId: 1, tipo: "real", recalculado: false }),
    );
    const payload = (logRepo.create as jest.Mock).mock.calls[0][0] as Partial<RutaOptimizadaLog>;
    expect(payload.waypointsGeojson).toBeDefined();
  });

  it("consulta devuelve el reporte del día con trayectorias planificada y real", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    // planificada existe.
    (logRepo.findOne as jest.Mock).mockImplementation((opts) => {
      if (opts.where?.tipo === "planificada") {
        return Promise.resolve({ tipo: "planificada", waypointsGeojson: [] } as RutaOptimizadaLog);
      }
      return Promise.resolve({ tipo: "real", waypointsGeojson: [] } as RutaOptimizadaLog);
    });
    (reporteRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      rutaId: 1,
      fecha: "2026-08-19",
      trayectoriasJson: { type: "FeatureCollection", features: [] },
    } as ReporteDiario);

    const result = await service.consultar(1, adminContext);

    expect(result.trayectoriasJson).toBeDefined();
    expect(result.fecha).toBe("2026-08-19");
  });

  it("consulta lanza NotFoundException si no hay reporte del día", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (reporteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.consultar(1, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("generarReporteDiario consolida features de planificada y real con su origen", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    // Planificada guarda orden_clientes_json como Trayecto[][] plano (HU-55).
    (logRepo.findOne as jest.Mock).mockImplementation((opts) => {
      if (opts.where?.tipo === "planificada") {
        return Promise.resolve({
          tipo: "planificada",
          ordenClientesJson: [[{ latitud: -17.78, longitud: -63.18 }]],
          waypointsGeojson: [],
        } as RutaOptimizadaLog);
      }
      return Promise.resolve({
        tipo: "real",
        ordenClientesJson: [
          { latitud: -17.79, longitud: -63.19 },
          { latitud: -17.8, longitud: -63.2 },
        ],
        waypointsGeojson: [],
      } as RutaOptimizadaLog);
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
});