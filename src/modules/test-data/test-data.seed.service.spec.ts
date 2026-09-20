import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Cartera } from "../carteras/cartera.entity";
import { Cuota } from "../clientes/cuota.entity";
import { Prestamo } from "../clientes/prestamo.entity";
import { Device } from "../sincronizacion-offline/device.entity";
import { PasswordService } from "../security/password.service";
import { PropietariosService } from "../propietarios/propietarios.service";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { GestoresService } from "../gestores/gestores.service";
import { GestoresPermisosService } from "../gestores/gestores-permisos.service";
import { CarterasService } from "../carteras/carteras.service";
import { CarteraConfigService } from "../carteras/cartera-config.service";
import { CarteraOptimizacionService } from "../carteras/cartera-optimizacion.service";
import { GastosService } from "../carteras/gastos.service";
import { InyeccionesService } from "../carteras/inyecciones.service";
import { CarterasNotasService } from "../carteras/carteras-notas.service";
import { LiquidacionesService } from "../carteras/liquidaciones.service";
import { TrayectoriasService } from "../carteras/trayectorias.service";
import { ClienteService } from "../clientes/cliente.service";
import { PrestamoService } from "../clientes/prestamo.service";
import { PagosService } from "../clientes/pagos.service";
import { AbonosService } from "../clientes/abonos.service";
import { TestDataSeedService } from "./test-data.seed.service";

describe("TestDataSeedService", () => {
  let service: TestDataSeedService;
  let config: ConfigService;
  let clientesIds: number;
  let adminRepo: { findOne: jest.Mock };
  let propietarioRepo: { findOne: jest.Mock };
  let cuotaRepo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock };
  let gestorRepo: { find: jest.Mock };
  let carteraRepo: { find: jest.Mock; findOne: jest.Mock };
  let prestamoRepo: { count: jest.Mock; update: jest.Mock };
  let propietariosService: { create: jest.Mock };
  let permisosPropietario: { setMatriz: jest.Mock };
  let gestoresService: { create: jest.Mock };
  let carterasService: { create: jest.Mock };
  let clienteService: { crear: jest.Mock; listar: jest.Mock };
  let prestamoService: { crear: jest.Mock };
  let pagosService: { registrarPagoDeCuota: jest.Mock };
  let abonosService: { registrarAbono: jest.Mock };
  let gastosService: { registrar: jest.Mock; aprobar: jest.Mock };
  let inyeccionesService: { crear: jest.Mock };
  let notasService: { crear: jest.Mock };
  let liquidacionesService: { generar: jest.Mock };
  let trayectoriasService: { generarReporteDiario: jest.Mock };
  let carteraOptimizacionService: { generar: jest.Mock };

  const mockAdminRepo = { findOne: jest.fn() };
  const mockPropietarioRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { find: jest.fn(), findOne: jest.fn(), update: jest.fn() };
  const mockGestorRepo = { find: jest.fn() };
  const mockCarteraRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockPrestamoRepo = { count: jest.fn(), update: jest.fn() };
  const mockPropietariosService = { create: jest.fn() };
  const mockPermisosPropietario = { setMatriz: jest.fn() };
  const mockGestoresService = { create: jest.fn() };
  const mockGestoresPermisos = { setMatriz: jest.fn() };
  const mockCarterasService = { create: jest.fn() };
  const mockCarteraConfigService = { setMatriz: jest.fn() };
  const mockClienteService = { crear: jest.fn(), listar: jest.fn() };
  const mockPrestamoService = { crear: jest.fn() };
  const mockPagosService = { registrarPagoDeCuota: jest.fn() };
  const mockAbonosService = { registrarAbono: jest.fn() };
  const mockGastosService = { registrar: jest.fn(), aprobar: jest.fn() };
  const mockInyeccionesService = { crear: jest.fn() };
  const mockNotasService = { crear: jest.fn() };
  const mockLiquidacionesService = { generar: jest.fn() };
  const mockTrayectoriasService = { generarReporteDiario: jest.fn() };
  const mockCarteraOptimizacionService = { generar: jest.fn() };

  async function compilar(seedValue?: string): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [
        TestDataSeedService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(seedValue) } },
        { provide: getRepositoryToken(AdminUser), useValue: mockAdminRepo },
        { provide: getRepositoryToken(Propietario), useValue: mockPropietarioRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Gestor), useValue: mockGestorRepo },
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(Prestamo), useValue: mockPrestamoRepo },
        { provide: getRepositoryToken(Device), useValue: { create: jest.fn((v: unknown) => v), save: jest.fn() } },
        { provide: PasswordService, useValue: { hash: jest.fn().mockResolvedValue("hash") } },
        { provide: PropietariosService, useValue: mockPropietariosService },
        { provide: PermisosPropietarioService, useValue: mockPermisosPropietario },
        { provide: GestoresService, useValue: mockGestoresService },
        { provide: GestoresPermisosService, useValue: mockGestoresPermisos },
        { provide: CarterasService, useValue: mockCarterasService },
        { provide: CarteraConfigService, useValue: mockCarteraConfigService },
        { provide: ClienteService, useValue: mockClienteService },
        { provide: PrestamoService, useValue: mockPrestamoService },
        { provide: PagosService, useValue: mockPagosService },
        { provide: AbonosService, useValue: mockAbonosService },
        { provide: GastosService, useValue: mockGastosService },
        { provide: InyeccionesService, useValue: mockInyeccionesService },
        { provide: CarterasNotasService, useValue: mockNotasService },
        { provide: LiquidacionesService, useValue: mockLiquidacionesService },
        { provide: TrayectoriasService, useValue: mockTrayectoriasService },
        { provide: CarteraOptimizacionService, useValue: mockCarteraOptimizacionService },
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
    propietarioRepo = mockPropietarioRepo;
    cuotaRepo = mockCuotaRepo;
    gestorRepo = mockGestorRepo;
    carteraRepo = mockCarteraRepo;
    prestamoRepo = mockPrestamoRepo;
    propietariosService = mockPropietariosService;
    permisosPropietario = mockPermisosPropietario;
    gestoresService = mockGestoresService;
    carterasService = mockCarterasService;
    clienteService = mockClienteService;
    prestamoService = mockPrestamoService;
    pagosService = mockPagosService;
    abonosService = mockAbonosService;
    gastosService = mockGastosService;
    inyeccionesService = mockInyeccionesService;
    notasService = mockNotasService;
    liquidacionesService = mockLiquidacionesService;
    trayectoriasService = mockTrayectoriasService;
    carteraOptimizacionService = mockCarteraOptimizacionService;
  });

  it("no hace nada si SEED_TEST_DATA no está activo", async () => {
    jest.spyOn(config, "get").mockReturnValue(undefined);

    await service.bootstrap();

    expect(propietarioRepo.findOne).not.toHaveBeenCalled();
    expect(propietariosService.create).not.toHaveBeenCalled();
  });

  it("se omite si no hay admin activo", async () => {
    adminRepo.findOne.mockResolvedValue(null);

    await service.bootstrap();

    expect(propietarioRepo.findOne).not.toHaveBeenCalled();
    expect(propietariosService.create).not.toHaveBeenCalled();
  });

  it("no re-crea el propietario si ya existe el marcador, solo sincroniza", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    propietarioRepo.findOne.mockResolvedValue({ id: 1, usuario: "test-propietario-1" });
    gestorRepo.find.mockResolvedValue([{ id: 2 }]);
    carteraRepo.find.mockResolvedValue([]);
    carteraRepo.findOne.mockResolvedValue(null);
    carterasService.create.mockResolvedValueOnce({ id: 20 }).mockResolvedValueOnce({ id: 21 });
    carteraOptimizacionService.generar.mockResolvedValue([]);
    clienteService.crear.mockImplementation(async () => ({ id: (clientesIds += 1) }));
    prestamoService.crear.mockResolvedValue({ id: 300 });
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 300, valorEsperado: 100 });
    (carteraRepo as unknown as { update: jest.Mock }).update = jest.fn();

    await service.bootstrap();

    expect(propietariosService.create).not.toHaveBeenCalled();
    expect(mockGestoresPermisos.setMatriz).toHaveBeenCalled();
    expect(carterasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Cartera Manizales", moneda: "COP" }),
      { rol: "admin", sub: 5 },
    );
  });

  it("carga la data de prueba con contexto de admin cuando aplica", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    propietarioRepo.findOne.mockResolvedValue(null);
    propietariosService.create.mockResolvedValue({ id: 1 });
    gestoresService.create.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce({ id: 3 });
    carteraRepo.findOne.mockResolvedValue(null);
    carterasService.create
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
    (carteraRepo as unknown as { update: jest.Mock }).update = jest.fn();
    carteraOptimizacionService.generar.mockResolvedValue([]);

    await service.bootstrap();

    expect(propietariosService.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuario: "test-propietario-1", codigo: "TEST-SC-001" }),
    );
    expect(permisosPropietario.setMatriz).toHaveBeenCalledWith(1, expect.objectContaining({ configurar_cartera: true }));
    expect(mockGestoresPermisos.setMatriz).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ registrar_prestamo: true, registrar_abono: true, ver_cartera: true }),
    );
    expect(mockCarteraConfigService.setMatriz).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        reconocimientoFacialActivo: true,
        registroDocumentoCliente: true,
        permitirCambioFechaPrestamo: true,
      }),
      { rol: "admin", sub: 5 },
    );
    expect(carterasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Cartera Centro" }),
      { rol: "admin", sub: 5 },
    );
    expect(carterasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Cartera Manizales", moneda: "COP" }),
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
    expect(carteraOptimizacionService.generar).toHaveBeenCalledWith(12, { rol: "admin", sub: 5 });
    expect(mockPrestamoRepo.update).toHaveBeenCalledWith(200, { estatus: "liquidado" });
  });

  it("re-sincroniza permisos APK y siembra cartera cuando el propietario ya existe sin préstamos", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    propietarioRepo.findOne.mockResolvedValue({ id: 1, usuario: "test-propietario-1" });
    gestorRepo.find.mockResolvedValue([{ id: 2 }, { id: 3 }]);
    carteraRepo.find.mockResolvedValue([{ id: 10, nombre: "test-Cartera Centro" }]);
    carteraRepo.findOne.mockResolvedValue(null);
    prestamoRepo.count.mockResolvedValue(0);
    clienteService.listar.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 200, valorEsperado: 100 });
    carterasService.create.mockResolvedValueOnce({ id: 20 }).mockResolvedValueOnce({ id: 21 });
    carteraOptimizacionService.generar.mockResolvedValue([]);
    clienteService.crear.mockImplementation(async () => ({ id: (clientesIds += 1) }));
    prestamoService.crear.mockResolvedValue({ id: 300 });
    (carteraRepo as unknown as { update: jest.Mock }).update = jest.fn();

    await service.bootstrap();

    expect(propietariosService.create).not.toHaveBeenCalled();
    expect(mockGestoresPermisos.setMatriz).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ registrar_prestamo: true }),
    );
    expect(mockGestoresPermisos.setMatriz).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ registrar_prestamo: true }),
    );
    expect(prestamoService.crear).toHaveBeenCalled();
    expect(pagosService.registrarPagoDeCuota).toHaveBeenCalled();
    expect(abonosService.registrarAbono).toHaveBeenCalled();
    expect(carterasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Cartera Manizales", moneda: "COP" }),
      { rol: "admin", sub: 5 },
    );
    expect(carteraOptimizacionService.generar).toHaveBeenCalledWith(20, { rol: "admin", sub: 5 });
  });

  it("no duplica cartera cuando el propietario ya existe y tiene préstamos", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    propietarioRepo.findOne.mockResolvedValue({ id: 1, usuario: "test-propietario-1" });
    gestorRepo.find.mockResolvedValue([{ id: 2 }]);
    carteraRepo.find.mockResolvedValue([{ id: 10, nombre: "test-Cartera Centro" }]);
    carteraRepo.findOne.mockResolvedValue(null);
    prestamoRepo.count.mockResolvedValue(3);
    carterasService.create.mockResolvedValueOnce({ id: 20 }).mockResolvedValueOnce({ id: 21 });
    carteraOptimizacionService.generar.mockResolvedValue([]);
    clienteService.crear.mockImplementation(async () => ({ id: (clientesIds += 1) }));
    prestamoService.crear.mockResolvedValue({ id: 300 });
    cuotaRepo.find.mockResolvedValue([{ id: 1, valorEsperado: 100 }]);
    cuotaRepo.findOne.mockResolvedValue({ id: 2, prestamoId: 200, valorEsperado: 100 });
    (carteraRepo as unknown as { update: jest.Mock }).update = jest.fn();

    await service.bootstrap();

    // La cartera existente (cartera 10) no se duplica; Manizales (nueva, cartera 20) sí se siembra.
    const llamadasConCartera10 = prestamoService.crear.mock.calls.filter((c) => c[0] === 10);
    const llamadasConCartera20 = prestamoService.crear.mock.calls.filter((c) => c[0] === 20);
    expect(llamadasConCartera10).toHaveLength(0);
    expect(llamadasConCartera20.length).toBeGreaterThan(0);
    expect(mockGestoresPermisos.setMatriz).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ registrar_prestamo: true }),
    );
    // Los préstamos liquidado/cancelado de Manizales dejan sus cuotas como
    // "pagada" (evita la "mora fantasma" en la APK).
    expect(cuotaRepo.update).toHaveBeenCalledWith(
      { prestamo: { id: 300 } },
      { estatus: "pagada" },
    );
  });

  it("crea una cartera de prueba en estado bloqueado (inactiva) asignada al gestor A", async () => {
    adminRepo.findOne.mockResolvedValue({ id: 5, estado: "activo" });
    propietarioRepo.findOne.mockResolvedValue(null);
    propietariosService.create.mockResolvedValue({ id: 1 });
    gestoresService.create.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce({ id: 3 });
    carteraRepo.find.mockResolvedValue([]);
    carteraRepo.findOne.mockResolvedValue(null);
    // Centro(10), Norte(11), Manizales(12), Inactiva(13)
    carterasService.create
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
    carteraOptimizacionService.generar.mockResolvedValue([]);
    (carteraRepo as unknown as { update: jest.Mock }).update = jest.fn();

    await service.bootstrap();

    // La cartera inactiva se crea con datos y luego se marca como bloqueada.
    expect(carterasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "test-Cartera Inactiva" }),
      { rol: "admin", sub: 5 },
    );
    expect((carteraRepo as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.anything(),
      { estatus: "bloqueado" },
    );
  });
});