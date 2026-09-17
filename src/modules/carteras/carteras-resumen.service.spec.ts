import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cartera } from "./cartera.entity";
import { CarteraConfig } from "./cartera-config.entity";
import { Caja } from "./caja.entity";
import { Liquidacion } from "./liquidacion.entity";
import { LiquidacionesService } from "./liquidaciones.service";
import { CarterasResumenService } from "./carteras-resumen.service";

describe("CarterasResumenService", () => {
  let service: CarterasResumenService;
  let carteraRepo: Repository<Cartera>;
  let configRepo: Repository<CarteraConfig>;
  let cajaRepo: Repository<Caja>;
  let liquidacionRepo: Repository<Liquidacion>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockCajaRepo = { findOne: jest.fn() };
  const mockLiquidacionRepo = { findOne: jest.fn() };
  const mockLiquidacionesService = { calcularTotales: jest.fn() };

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

  function configFixture(overrides: Partial<CarteraConfig> = {}): CarteraConfig {
    return {
      id: 1,
      carteraId: 1,
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
    } as CarteraConfig;
  }

  function cajaFixture(overrides: Partial<Caja> = {}): Caja {
    return {
      id: 1,
      carteraId: 1,
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
        CarterasResumenService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(CarteraConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: mockLiquidacionRepo },
        { provide: LiquidacionesService, useValue: mockLiquidacionesService },
      ],
    }).compile();

    service = module.get(CarterasResumenService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    configRepo = module.get(getRepositoryToken(CarteraConfig));
    cajaRepo = module.get(getRepositoryToken(Caja));
    liquidacionRepo = module.get(getRepositoryToken(Liquidacion));
  });

  it("lanza NotFoundException si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede ver el resumen de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(service.obtener(1, propietarioContext)).rejects.toThrow(ForbiddenException);
  });

  it("construye el resumen con caja, totales, comisión, préstamos y clientes", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
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
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
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