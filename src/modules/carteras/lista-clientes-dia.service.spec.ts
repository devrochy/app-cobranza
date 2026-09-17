import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cartera } from "./cartera.entity";
import { CarteraConfig } from "./cartera-config.entity";
import { CarteraOptimizadaLog } from "./cartera-optimizada-log.entity";
import { ListaClientesDelDiaService } from "./lista-clientes-dia.service";
import { CarteraOptimizacionService } from "./cartera-optimizacion.service";

describe("ListaClientesDelDiaService", () => {
  let service: ListaClientesDelDiaService;
  let carteraRepo: Repository<Cartera>;
  let configRepo: Repository<CarteraConfig>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockLogRepo = { findOne: jest.fn(), manager: { createQueryBuilder: jest.fn() } };
  const mockCarteraOptimizacion = { consultar: jest.fn() };

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
      comisionActiva: false,
      comisionPorcentaje: 0,
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
    } as CarteraConfig;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListaClientesDelDiaService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(CarteraConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(CarteraOptimizadaLog), useValue: mockLogRepo },
        { provide: CarteraOptimizacionService, useValue: mockCarteraOptimizacion },
      ],
    }).compile();

    service = module.get(ListaClientesDelDiaService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    configRepo = module.get(getRepositoryToken(CarteraConfig));
  });

  it("lanza NotFoundException si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede ver la lista de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(service.obtener(1, propietarioContext)).rejects.toThrow(ForbiddenException);
  });

  it("construye la lista con clientes en trayecto y al día, con color", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ cuotasAtrasoUmbral: 1 }));
    // trayecto planificado con cliente 1 (deuda).
    mockCarteraOptimizacion.consultar.mockResolvedValue({
      id: 10,
      carteraId: 1,
      tipo: "planificada",
      ordenClientes: [[{ clienteId: 1, latitud: -17.7, longitud: -63.1 }]],
    });
    // clientes de la cartera (todos con préstamo vigente): 1 con deuda y atraso 2, 2 al día.
    (service as unknown as { listarClientesConEstado: jest.Mock }).listarClientesConEstado = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, nombre: "A", atraso: 2, esNuevo: false, diasMora: 5, compromisoValor: null },
        { clienteId: 2, nombre: "B", atraso: 0, esNuevo: false, diasMora: 0, compromisoValor: 300 },
      ]);
    // visitas de hoy: cliente 2 pagó.
    (service as unknown as { clientesConVisitaPagoHoy: jest.Mock }).clientesConVisitaPagoHoy = jest
      .fn()
      .mockResolvedValue([2]);

    const result = await service.obtener(1, adminContext);

    const c1 = result.find((c) => c.clienteId === 1);
    const c2 = result.find((c) => c.clienteId === 2);

    expect(c1).toMatchObject({ enTrayecto: true, color: "rojo", visitaRegistrada: false, diasMora: 5 });
    expect(c2).toMatchObject({ enTrayecto: false, color: "verde", visitaRegistrada: true, compromisoValor: 300 });
    expect(result).toHaveLength(2);
  });

  it("mueve los clientes que ya pagaron hoy a la cola de la lista", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ cuotasAtrasoUmbral: 1 }));
    mockCarteraOptimizacion.consultar.mockRejectedValue(new NotFoundException());
    (service as unknown as { listarClientesConEstado: jest.Mock }).listarClientesConEstado = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, nombre: "Pagó hoy", atraso: 0, esNuevo: false, diasMora: 0, compromisoValor: null },
        { clienteId: 2, nombre: "En mora", atraso: 2, esNuevo: false, diasMora: 10, compromisoValor: null },
      ]);
    // El cliente 1 ya pagó hoy (visita de pago).
    (service as unknown as { clientesConVisitaPagoHoy: jest.Mock }).clientesConVisitaPagoHoy = jest
      .fn()
      .mockResolvedValue([1]);

    const result = await service.obtener(1, adminContext);

    expect(result.map((c) => c.clienteId)).toEqual([2, 1]);
  });

  it("marca enTrayecto=false si no hay trayecto planificado", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ cuotasAtrasoUmbral: 1 }));
    mockCarteraOptimizacion.consultar.mockRejectedValue(new NotFoundException());
    (service as unknown as { listarClientesConEstado: jest.Mock }).listarClientesConEstado = jest
      .fn()
      .mockResolvedValue([{ clienteId: 1, nombre: "A", atraso: 0, esNuevo: false, diasMora: 0, compromisoValor: null }]);
    (service as unknown as { clientesConVisitaPagoHoy: jest.Mock }).clientesConVisitaPagoHoy = jest
      .fn()
      .mockResolvedValue([]);

    const result = await service.obtener(1, adminContext);

    expect(result[0].enTrayecto).toBe(false);
    expect(result[0].color).toBe("verde");
  });

  it("obtenerMapa devuelve markers de negocio y domicilio por cliente", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (service as unknown as { obtener: jest.Mock }).obtener = jest.fn().mockResolvedValue([
      { clienteId: 1, nombre: "Juan Perez", enTrayecto: true, color: "rojo" },
    ]);
    (service as unknown as { coordenadasDeClientes: jest.Mock }).coordenadasDeClientes = jest
      .fn()
      .mockResolvedValue([
        {
          clienteId: 1,
          negocio: { latitud: -17.7, longitud: -63.1 },
          domicilio: { latitud: -17.71, longitud: -63.11 },
        },
      ]);

    const result = await service.obtenerMapa(1, adminContext);

    expect(result).toHaveLength(2);
    const negocio = result.find((m) => m.tipo === "negocio");
    const domicilio = result.find((m) => m.tipo === "domicilio");
    expect(negocio).toMatchObject({ clienteId: 1, latitud: -17.7, longitud: -63.1, color: "rojo" });
    expect(domicilio).toMatchObject({ clienteId: 1, latitud: -17.71, longitud: -63.11 });
  });

  it("obtenerMapa no genera marker de domicilio si el cliente no tiene domicilio", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (service as unknown as { obtener: jest.Mock }).obtener = jest.fn().mockResolvedValue([
      { clienteId: 2, nombre: "Sin Domicilio", enTrayecto: false, color: "blanco" },
    ]);
    (service as unknown as { coordenadasDeClientes: jest.Mock }).coordenadasDeClientes = jest
      .fn()
      .mockResolvedValue([
        {
          clienteId: 2,
          negocio: { latitud: -17.7, longitud: -63.1 },
          domicilio: null,
        },
      ]);

    const result = await service.obtenerMapa(1, adminContext);

    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe("negocio");
  });
});