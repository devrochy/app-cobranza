import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { RutaOptimizadaLog } from "./ruta-optimizada-log.entity";
import { ListaClientesDelDiaService } from "./lista-clientes-dia.service";
import { RutaOptimizacionService } from "./ruta-optimizacion.service";

describe("ListaClientesDelDiaService", () => {
  let service: ListaClientesDelDiaService;
  let rutaRepo: Repository<Ruta>;
  let configRepo: Repository<RutaConfig>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockLogRepo = { findOne: jest.fn(), manager: { createQueryBuilder: jest.fn() } };
  const mockRutaOptimizacion = { consultar: jest.fn() };

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
    } as RutaConfig;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListaClientesDelDiaService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(RutaOptimizadaLog), useValue: mockLogRepo },
        { provide: RutaOptimizacionService, useValue: mockRutaOptimizacion },
      ],
    }).compile();

    service = module.get(ListaClientesDelDiaService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    configRepo = module.get(getRepositoryToken(RutaConfig));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede ver la lista de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.obtener(1, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("construye la lista con clientes en trayecto y al día, con color", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ cuotasAtrasoUmbral: 1 }));
    // trayecto planificado con cliente 1 (deuda).
    mockRutaOptimizacion.consultar.mockResolvedValue({
      id: 10,
      rutaId: 1,
      tipo: "planificada",
      ordenClientes: [[{ clienteId: 1, latitud: -17.7, longitud: -63.1 }]],
    });
    // clientes de la ruta (todos con préstamo vigente): 1 con deuda y atraso 2, 2 al día.
    (service as unknown as { listarClientesConEstado: jest.Mock }).listarClientesConEstado = jest
      .fn()
      .mockResolvedValue([
        { clienteId: 1, nombre: "A", atraso: 2, esNuevo: false },
        { clienteId: 2, nombre: "B", atraso: 0, esNuevo: false },
      ]);
    // visitas de hoy: cliente 2 pagó.
    (service as unknown as { clientesConVisitaPagoHoy: jest.Mock }).clientesConVisitaPagoHoy = jest
      .fn()
      .mockResolvedValue([2]);

    const result = await service.obtener(1, adminContext);

    const c1 = result.find((c) => c.clienteId === 1);
    const c2 = result.find((c) => c.clienteId === 2);

    expect(c1).toMatchObject({ enTrayecto: true, color: "rojo", visitaRegistrada: false });
    expect(c2).toMatchObject({ enTrayecto: false, color: "verde", visitaRegistrada: true });
    expect(result).toHaveLength(2);
  });

  it("marca enTrayecto=false si no hay trayecto planificado", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ cuotasAtrasoUmbral: 1 }));
    mockRutaOptimizacion.consultar.mockRejectedValue(new NotFoundException());
    (service as unknown as { listarClientesConEstado: jest.Mock }).listarClientesConEstado = jest
      .fn()
      .mockResolvedValue([{ clienteId: 1, nombre: "A", atraso: 0 }]);
    (service as unknown as { clientesConVisitaPagoHoy: jest.Mock }).clientesConVisitaPagoHoy = jest
      .fn()
      .mockResolvedValue([]);

    const result = await service.obtener(1, adminContext);

    expect(result[0].enTrayecto).toBe(false);
    expect(result[0].color).toBe("verde");
  });

  it("obtenerMapa devuelve markers de negocio y domicilio por cliente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
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
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
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