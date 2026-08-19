import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { Caja } from "./caja.entity";
import { Liquidacion } from "./liquidacion.entity";
import { LiquidacionesService } from "./liquidaciones.service";
import { RutasResumenService } from "./rutas-resumen.service";

describe("RutasResumenService", () => {
  let service: RutasResumenService;
  let rutaRepo: Repository<Ruta>;
  let configRepo: Repository<RutaConfig>;
  let cajaRepo: Repository<Caja>;
  let liquidacionRepo: Repository<Liquidacion>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockCajaRepo = { findOne: jest.fn() };
  const mockLiquidacionRepo = { findOne: jest.fn() };
  const mockLiquidacionesService = { calcularTotales: jest.fn() };

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
      mostrarCaja: true,
      mostrarCobradoLiquidada: true,
      mostrarPrestamos: true,
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
      mostrarCobroEstimado: true,
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RutasResumenService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: mockLiquidacionRepo },
        { provide: LiquidacionesService, useValue: mockLiquidacionesService },
      ],
    }).compile();

    service = module.get(RutasResumenService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    configRepo = module.get(getRepositoryToken(RutaConfig));
    cajaRepo = module.get(getRepositoryToken(Caja));
    liquidacionRepo = module.get(getRepositoryToken(Liquidacion));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede ver el resumen de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.obtener(1, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("construye el resumen con caja, totales, comisión, préstamos y clientes", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture());
    (cajaRepo.findOne as jest.Mock).mockResolvedValue(cajaFixture());
    (liquidacionRepo.findOne as jest.Mock).mockResolvedValue(null);
    (mockLiquidacionesService.calcularTotales as jest.Mock).mockResolvedValue({
      estimadoACobrar: 2000,
      sumaCartera: 1000,
      totalCobradoPeriodo: 200,
      totalCobradoDia: 200,
      totalPrestado: 500,
      totalGastos: 50,
      totalInyeccion: 300,
    });
    // préstamos activos y clientes se agregan por consultas SQL; mock en el repo.
    (service as unknown as { contarPrestamosActivos: jest.Mock }).contarPrestamosActivos = jest
      .fn()
      .mockResolvedValue({ cantidad: 3, valorTotal: 2000 });
    (service as unknown as { listarClientes: jest.Mock }).listarClientes = jest
      .fn()
      .mockResolvedValue([{ id: 1, nombre: "Juan", negocio: "Tienda" }]);

    const result = await service.obtener(1, adminContext);

    expect(result.cajaActual).toBe(1500);
    expect(result.cajaAnterior).toBe(1000);
    expect(result.cobradoPeriodo).toBe(200);
    expect(result.prestadoPeriodo).toBe(500);
    expect(result.gastosPeriodo).toBe(50);
    expect(result.inyeccionesPeriodo).toBe(300);
    expect(result.carteraVigente).toBe(1000);
    expect(result.prestamosActivos).toEqual({ cantidad: 3, valorTotal: 2000 });
    expect(result.comisionPorcentaje).toBe(10);
    expect(result.clientes).toHaveLength(1);
  });

  it("oculta la caja cuando mostrarCaja es false", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ mostrarCaja: false }));
    (cajaRepo.findOne as jest.Mock).mockResolvedValue(cajaFixture());
    (liquidacionRepo.findOne as jest.Mock).mockResolvedValue(null);
    (mockLiquidacionesService.calcularTotales as jest.Mock).mockResolvedValue({
      estimadoACobrar: 2000,
      sumaCartera: 1000,
      totalCobradoPeriodo: 200,
      totalCobradoDia: 200,
      totalPrestado: 500,
      totalGastos: 50,
      totalInyeccion: 300,
    });
    (service as unknown as { contarPrestamosActivos: jest.Mock }).contarPrestamosActivos = jest
      .fn()
      .mockResolvedValue({ cantidad: 0, valorTotal: 0 });
    (service as unknown as { listarClientes: jest.Mock }).listarClientes = jest.fn().mockResolvedValue([]);

    const result = await service.obtener(1, adminContext);

    expect(result.cajaActual).toBeUndefined();
    expect(result.cajaAnterior).toBeUndefined();
  });
});