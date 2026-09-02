import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { Cuota } from "../cartera/cuota.entity";
import { Device } from "../sincronizacion-offline/device.entity";
import { PasswordService } from "../security/password.service";
import { SociosService } from "../socios/socios.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CobradoresService } from "../cobradores/cobradores.service";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { RutasService } from "../rutas/rutas.service";
import { RutaConfigService } from "../rutas/ruta-config.service";
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
  let adminRepo: { findOne: jest.Mock };
  let socioRepo: { findOne: jest.Mock };
  let cuotaRepo: { find: jest.Mock; findOne: jest.Mock };
  let sociosService: { create: jest.Mock };
  let permisosSocio: { setMatriz: jest.Mock };
  let cobradoresService: { create: jest.Mock };
  let rutasService: { create: jest.Mock };
  let clienteService: { crear: jest.Mock };
  let prestamoService: { crear: jest.Mock };
  let pagosService: { registrarPagoDeCuota: jest.Mock };
  let abonosService: { registrarAbono: jest.Mock };
  let gastosService: { registrar: jest.Mock; aprobar: jest.Mock };
  let inyeccionesService: { crear: jest.Mock };
  let notasService: { crear: jest.Mock };
  let liquidacionesService: { generar: jest.Mock };
  let trayectoriasService: { generarReporteDiario: jest.Mock };

  const mockAdminRepo = { findOne: jest.fn() };
  const mockSocioRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockSociosService = { create: jest.fn() };
  const mockPermisosSocio = { setMatriz: jest.fn() };
  const mockCobradoresService = { create: jest.fn() };
  const mockCobradoresPermisos = { setMatriz: jest.fn() };
  const mockRutasService = { create: jest.fn() };
  const mockRutaConfigService = { setMatriz: jest.fn() };
  const mockClienteService = { crear: jest.fn() };
  const mockPrestamoService = { crear: jest.fn() };
  const mockPagosService = { registrarPagoDeCuota: jest.fn() };
  const mockAbonosService = { registrarAbono: jest.fn() };
  const mockGastosService = { registrar: jest.fn(), aprobar: jest.fn() };
  const mockInyeccionesService = { crear: jest.fn() };
  const mockNotasService = { crear: jest.fn() };
  const mockLiquidacionesService = { generar: jest.fn() };
  const mockTrayectoriasService = { generarReporteDiario: jest.fn() };

  async function compilar(seedValue?: string): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [
        TestDataSeedService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(seedValue) } },
        { provide: getRepositoryToken(AdminUser), useValue: mockAdminRepo },
        { provide: getRepositoryToken(Socio), useValue: mockSocioRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
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
      ],
    }).compile();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await compilar("true");
    service = module.get(TestDataSeedService);
    config = module.get(ConfigService);
    adminRepo = mockAdminRepo;
    socioRepo = mockSocioRepo;
    cuotaRepo = mockCuotaRepo;
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

  it("es idempotente: se omite si ya existe el socio marcador", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    socioRepo.findOne.mockResolvedValue({ id: 1 });

    await service.bootstrap();

    expect(sociosService.create).not.toHaveBeenCalled();
  });

  it("carga la data de prueba con contexto de admin cuando aplica", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    socioRepo.findOne.mockResolvedValue(null);
    sociosService.create.mockResolvedValue({ id: 1 });
    cobradoresService.create.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce({ id: 3 });
    rutasService.create.mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({ id: 11 });
    clienteService.crear.mockImplementation(async () => ({ id: Math.floor(Math.random() * 1000) }));
    prestamoService.crear.mockResolvedValue({ id: 200 });
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 200, valorEsperado: 100 });
    gastosService.registrar.mockResolvedValue({ id: 300 });
    liquidacionesService.generar.mockResolvedValue({ id: 400 });

    await service.bootstrap();

    expect(sociosService.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuario: "test-socio-1", codigo: "TEST-SC-001" }),
    );
    expect(permisosSocio.setMatriz).toHaveBeenCalledWith(1, expect.objectContaining({ configurar_ruta: true }));
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
    expect(clienteService.crear).toHaveBeenCalled();
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
  });
});