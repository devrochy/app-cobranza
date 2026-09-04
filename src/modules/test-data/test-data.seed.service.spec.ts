import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Ruta } from "../rutas/ruta.entity";
import { Cuota } from "../cartera/cuota.entity";
import { Prestamo } from "../cartera/prestamo.entity";
import { Device } from "../sincronizacion-offline/device.entity";
import { PasswordService } from "../security/password.service";
import { SociosService } from "../socios/socios.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CobradoresService } from "../cobradores/cobradores.service";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { RutasService } from "../rutas/rutas.service";
import { RutaConfigService } from "../rutas/ruta-config.service";
import { RutaOptimizacionService } from "../rutas/ruta-optimizacion.service";
import { GastosService } from "../rutas/gastos.service";
import { InyeccionesService } from "../rutas/inyecciones.service";
import { RutasNotasService } from "../rutas/rutas-notas.service";
import { LiquidacionesService } from "../rutas/liquidaciones.service";
import { TrayectoriasService } from "../rutas/trayectorias.service";
import { ClienteService } from "../cartera/cliente.service";
import { PrestamoService } from "../cartera/prestamo.service";
import { PagosService } from "../cartera/pagos.service";
import { AbonosService } from "../cartera/abonos.service";
import { TestDataSeedService } from "./test-data.seed.service";

describe("TestDataSeedService", () => {
  let service: TestDataSeedService;
  let config: ConfigService;
  let clientesIds: number;
  let adminRepo: { findOne: jest.Mock };
  let socioRepo: { findOne: jest.Mock };
  let cuotaRepo: { find: jest.Mock; findOne: jest.Mock };
  let cobradorRepo: { find: jest.Mock };
  let rutaRepo: { find: jest.Mock; findOne: jest.Mock };
  let prestamoRepo: { count: jest.Mock; update: jest.Mock };
  let sociosService: { create: jest.Mock };
  let permisosSocio: { setMatriz: jest.Mock };
  let cobradoresService: { create: jest.Mock };
  let rutasService: { create: jest.Mock };
  let clienteService: { crear: jest.Mock; listar: jest.Mock };
  let prestamoService: { crear: jest.Mock };
  let pagosService: { registrarPagoDeCuota: jest.Mock };
  let abonosService: { registrarAbono: jest.Mock };
  let gastosService: { registrar: jest.Mock; aprobar: jest.Mock };
  let inyeccionesService: { crear: jest.Mock };
  let notasService: { crear: jest.Mock };
  let liquidacionesService: { generar: jest.Mock };
  let trayectoriasService: { generarReporteDiario: jest.Mock };
  let rutaOptimizacionService: { generar: jest.Mock };

  const mockAdminRepo = { findOne: jest.fn() };
  const mockSocioRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockCobradorRepo = { find: jest.fn() };
  const mockRutaRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockPrestamoRepo = { count: jest.fn(), update: jest.fn() };
  const mockSociosService = { create: jest.fn() };
  const mockPermisosSocio = { setMatriz: jest.fn() };
  const mockCobradoresService = { create: jest.fn() };
  const mockCobradoresPermisos = { setMatriz: jest.fn() };
  const mockRutasService = { create: jest.fn() };
  const mockRutaConfigService = { setMatriz: jest.fn() };
  const mockClienteService = { crear: jest.fn(), listar: jest.fn() };
  const mockPrestamoService = { crear: jest.fn() };
  const mockPagosService = { registrarPagoDeCuota: jest.fn() };
  const mockAbonosService = { registrarAbono: jest.fn() };
  const mockGastosService = { registrar: jest.fn(), aprobar: jest.fn() };
  const mockInyeccionesService = { crear: jest.fn() };
  const mockNotasService = { crear: jest.fn() };
  const mockLiquidacionesService = { generar: jest.fn() };
  const mockTrayectoriasService = { generarReporteDiario: jest.fn() };
  const mockRutaOptimizacionService = { generar: jest.fn() };

  async function compilar(seedValue?: string): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [
        TestDataSeedService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(seedValue) } },
        { provide: getRepositoryToken(AdminUser), useValue: mockAdminRepo },
        { provide: getRepositoryToken(Socio), useValue: mockSocioRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Cobrador), useValue: mockCobradorRepo },
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Prestamo), useValue: mockPrestamoRepo },
        { provide: getRepositoryToken(Device), useValue: { create: jest.fn((v: unknown) => v), save: jest.fn() } },
        { provide: PasswordService, useValue: { hash: jest.fn().mockResolvedValue("hash") } },
        { provide: SociosService, useValue: mockSociosService },
        { provide: PermisosSocioService, useValue: mockPermisosSocio },
        { provide: CobradoresService, useValue: mockCobradoresService },
        { provide: CobradoresPermisosService, useValue: mockCobradoresPermisos },
        { provide: RutasService, useValue: mockRutasService },
        { provide: RutaConfigService, useValue: mockRutaConfigService },
        { provide: ClienteService, useValue: mockClienteService },
        { provide: PrestamoService, useValue: mockPrestamoService },
        { provide: PagosService, useValue: mockPagosService },
        { provide: AbonosService, useValue: mockAbonosService },
        { provide: GastosService, useValue: mockGastosService },
        { provide: InyeccionesService, useValue: mockInyeccionesService },
        { provide: RutasNotasService, useValue: mockNotasService },
        { provide: LiquidacionesService, useValue: mockLiquidacionesService },
        { provide: TrayectoriasService, useValue: mockTrayectoriasService },
        { provide: RutaOptimizacionService, useValue: mockRutaOptimizacionService },
      ],
    }).compile();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    clientesIds = 100;
    const module = await compilar("true");
    service = module.get(TestDataSeedService);
    config = module.get(ConfigService);
    adminRepo = mockAdminRepo;
    socioRepo = mockSocioRepo;
    cuotaRepo = mockCuotaRepo;
    cobradorRepo = mockCobradorRepo;
    rutaRepo = mockRutaRepo;
    prestamoRepo = mockPrestamoRepo;
    sociosService = mockSociosService;
    permisosSocio = mockPermisosSocio;
    cobradoresService = mockCobradoresService;
    rutasService = mockRutasService;
    clienteService = mockClienteService;
    prestamoService = mockPrestamoService;
    pagosService = mockPagosService;
    abonosService = mockAbonosService;
    gastosService = mockGastosService;
    inyeccionesService = mockInyeccionesService;
    notasService = mockNotasService;
    liquidacionesService = mockLiquidacionesService;
    trayectoriasService = mockTrayectoriasService;
    rutaOptimizacionService = mockRutaOptimizacionService;
  });

  it("no hace nada si SEED_TEST_DATA no está activo", async () => {
    jest.spyOn(config, "get").mockReturnValue(undefined);

    await service.bootstrap();

    expect(socioRepo.findOne).not.toHaveBeenCalled();
    expect(sociosService.create).not.toHaveBeenCalled();
  });

  it("se omite si no hay admin activo", async () => {
    adminRepo.findOne.mockResolvedValue(null);

    await service.bootstrap();

    expect(socioRepo.findOne).not.toHaveBeenCalled();
    expect(sociosService.create).not.toHaveBeenCalled();
  });

  it("no re-crea el socio si ya existe el marcador, solo sincroniza", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    socioRepo.findOne.mockResolvedValue({ id: 1, usuario: "test-socio-1" });
    cobradorRepo.find.mockResolvedValue([{ id: 2 }]);
    rutaRepo.find.mockResolvedValue([]);
    rutaRepo.findOne.mockResolvedValue(null);
    rutasService.create.mockResolvedValueOnce({ id: 20 }).mockResolvedValueOnce({ id: 21 });
    rutaOptimizacionService.generar.mockResolvedValue([]);
    clienteService.crear.mockImplementation(async () => ({ id: (clientesIds += 1) }));
    prestamoService.crear.mockResolvedValue({ id: 300 });
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 300, valorEsperado: 100 });
    (rutaRepo as unknown as { update: jest.Mock }).update = jest.fn();

    await service.bootstrap();

    expect(sociosService.create).not.toHaveBeenCalled();
    expect(mockCobradoresPermisos.setMatriz).toHaveBeenCalled();
    expect(rutasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Ruta Manizales", moneda: "COP" }),
      { rol: "admin", sub: 5 },
    );
  });

  it("carga la data de prueba con contexto de admin cuando aplica", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    socioRepo.findOne.mockResolvedValue(null);
    sociosService.create.mockResolvedValue({ id: 1 });
    cobradoresService.create.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce({ id: 3 });
    rutaRepo.findOne.mockResolvedValue(null);
    rutasService.create
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce({ id: 12 })
      .mockResolvedValueOnce({ id: 13 });
    clienteService.crear.mockImplementation(async () => ({ id: (clientesIds += 1) }));
    prestamoService.crear.mockResolvedValue({ id: 200 });
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 200, valorEsperado: 100 });
    gastosService.registrar.mockResolvedValue({ id: 300 });
    liquidacionesService.generar.mockResolvedValue({ id: 400 });
    (rutaRepo as unknown as { update: jest.Mock }).update = jest.fn();
    rutaOptimizacionService.generar.mockResolvedValue([]);

    await service.bootstrap();

    expect(sociosService.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuario: "test-socio-1", codigo: "TEST-SC-001" }),
    );
    expect(permisosSocio.setMatriz).toHaveBeenCalledWith(1, expect.objectContaining({ configurar_ruta: true }));
    expect(mockCobradoresPermisos.setMatriz).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ registrar_prestamo: true, registrar_abono: true, ver_cartera: true }),
    );
    expect(mockRutaConfigService.setMatriz).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        reconocimientoFacialActivo: true,
        registroDocumentoCliente: true,
        permitirCambioFechaPrestamo: true,
      }),
      { rol: "admin", sub: 5 },
    );
    expect(rutasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Ruta Centro" }),
      { rol: "admin", sub: 5 },
    );
    expect(rutasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Ruta Manizales", moneda: "COP" }),
      { rol: "admin", sub: 5 },
    );
    expect(clienteService.crear).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ nombre: "Laura", apellido: "Martínez", telefonoWhatsapp: "+573184935933" }),
      expect.any(Array),
      { rol: "admin", sub: 5 },
    );
    expect(prestamoService.crear).toHaveBeenCalled();
    expect(pagosService.registrarPagoDeCuota).toHaveBeenCalled();
    expect(abonosService.registrarAbono).toHaveBeenCalledWith(
      10,
      { prestamoId: 200, valor: 100, metodoPago: "efectivo" },
      { rol: "admin", sub: 5 },
    );
    expect(gastosService.registrar).toHaveBeenCalled();
    expect(gastosService.aprobar).toHaveBeenCalledWith(10, 300, { rol: "admin", sub: 5 });
    expect(inyeccionesService.crear).toHaveBeenCalled();
    expect(notasService.crear).toHaveBeenCalled();
    expect(liquidacionesService.generar).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ comentario: "test-liquidacion demo" }),
      { rol: "admin", sub: 5 },
    );
    expect(trayectoriasService.generarReporteDiario).toHaveBeenCalledWith(10, { rol: "admin", sub: 5 });
    expect(rutaOptimizacionService.generar).toHaveBeenCalledWith(12, { rol: "admin", sub: 5 });
    expect(mockPrestamoRepo.update).toHaveBeenCalledWith(200, { estatus: "liquidado" });
  });

  it("re-sincroniza permisos APK y siembra cartera cuando el socio ya existe sin préstamos", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    socioRepo.findOne.mockResolvedValue({ id: 1, usuario: "test-socio-1" });
    cobradorRepo.find.mockResolvedValue([{ id: 2 }, { id: 3 }]);
    rutaRepo.find.mockResolvedValue([{ id: 10, nombre: "test-Ruta Centro" }]);
    rutaRepo.findOne.mockResolvedValue(null);
    prestamoRepo.count.mockResolvedValue(0);
    clienteService.listar.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 200, valorEsperado: 100 });
    rutasService.create.mockResolvedValueOnce({ id: 20 }).mockResolvedValueOnce({ id: 21 });
    rutaOptimizacionService.generar.mockResolvedValue([]);
    clienteService.crear.mockImplementation(async () => ({ id: (clientesIds += 1) }));
    prestamoService.crear.mockResolvedValue({ id: 300 });
    (rutaRepo as unknown as { update: jest.Mock }).update = jest.fn();

    await service.bootstrap();

    expect(sociosService.create).not.toHaveBeenCalled();
    expect(mockCobradoresPermisos.setMatriz).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ registrar_prestamo: true }),
    );
    expect(mockCobradoresPermisos.setMatriz).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ registrar_prestamo: true }),
    );
    expect(prestamoService.crear).toHaveBeenCalled();
    expect(pagosService.registrarPagoDeCuota).toHaveBeenCalled();
    expect(abonosService.registrarAbono).toHaveBeenCalled();
    expect(rutasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Ruta Manizales", moneda: "COP" }),
      { rol: "admin", sub: 5 },
    );
    expect(rutaOptimizacionService.generar).toHaveBeenCalledWith(20, { rol: "admin", sub: 5 });
  });

  it("no duplica cartera cuando el socio ya existe y tiene préstamos", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    socioRepo.findOne.mockResolvedValue({ id: 1, usuario: "test-socio-1" });
    cobradorRepo.find.mockResolvedValue([{ id: 2 }]);
    rutaRepo.find.mockResolvedValue([{ id: 10, nombre: "test-Ruta Centro" }]);
    rutaRepo.findOne.mockResolvedValue(null);
    prestamoRepo.count.mockResolvedValue(3);
    rutasService.create.mockResolvedValueOnce({ id: 20 }).mockResolvedValueOnce({ id: 21 });
    rutaOptimizacionService.generar.mockResolvedValue([]);
    clienteService.crear.mockImplementation(async () => ({ id: (clientesIds += 1) }));
    prestamoService.crear.mockResolvedValue({ id: 300 });
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 200, valorEsperado: 100 });
    (rutaRepo as unknown as { update: jest.Mock }).update = jest.fn();

    await service.bootstrap();

    // La cartera existente (ruta 10) no se duplica; Manizales (nueva, ruta 20) sí se siembra.
    const llamadasConRuta10 = prestamoService.crear.mock.calls.filter((c) => c[0] === 10);
    const llamadasConRuta20 = prestamoService.crear.mock.calls.filter((c) => c[0] === 20);
    expect(llamadasConRuta10).toHaveLength(0);
    expect(llamadasConRuta20.length).toBeGreaterThan(0);
    expect(mockCobradoresPermisos.setMatriz).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ registrar_prestamo: true }),
    );
  });

  it("crea una ruta de prueba en estado bloqueado (inactiva) asignada al cobrador A", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    socioRepo.findOne.mockResolvedValue(null);
    sociosService.create.mockResolvedValue({ id: 1 });
    cobradoresService.create.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce({ id: 3 });
    rutaRepo.find.mockResolvedValue([]);
    rutaRepo.findOne.mockResolvedValue(null);
    // Centro(10), Norte(11), Manizales(12), Inactiva(13)
    rutasService.create
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce({ id: 12 })
      .mockResolvedValueOnce({ id: 13 });
    clienteService.crear.mockImplementation(async () => ({ id: (clientesIds += 1) }));
    prestamoService.crear.mockResolvedValue({ id: 200 });
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 200, valorEsperado: 100 });
    gastosService.registrar.mockResolvedValue({ id: 300 });
    liquidacionesService.generar.mockResolvedValue({ id: 400 });
    rutaOptimizacionService.generar.mockResolvedValue([]);
    (rutaRepo as unknown as { update: jest.Mock }).update = jest.fn();

    await service.bootstrap();

    // La ruta inactiva se crea con datos y luego se marca como bloqueada.
    expect(rutasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Ruta Inactiva" }),
      { rol: "admin", sub: 5 },
    );
    expect((rutaRepo as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.anything(),
      { estatus: "bloqueado" },
    );
  });
});