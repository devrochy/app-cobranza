import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Prestamo } from "./prestamo.entity";
import { Cuota } from "./cuota.entity";
import { Abono } from "./abono.entity";
import { Cliente } from "./cliente.entity";
import { WHATSAPP_GATEWAY } from "./whatsapp-gateway.interface";
import { NotificacionesService } from "./notificaciones.service";
import { EstadoCuentaService } from "./estado-cuenta.service";

describe("EstadoCuentaService", () => {
  let service: EstadoCuentaService;
  let rutaRepo: Repository<Ruta>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let abonoRepo: Repository<Abono>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockPrestamoRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { find: jest.fn() };
  const mockAbonoRepo = { find: jest.fn() };
  const mockGateway = { enviarMensaje: jest.fn(), recibirMensaje: jest.fn() };
  const mockNotificacionesService = { obtenerConversacion: jest.fn() };

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

  function prestamoFixture(overrides: Partial<Prestamo> = {}): Prestamo {
    return {
      id: 5,
      rutaId: 1,
      clienteId: 10,
      valor: 300,
      numCuotas: 3,
      tipoInteres: 0,
      diasEntreCuotas: 7,
      fechaOtorgado: new Date("2026-08-01"),
      fiadorNombre: null,
      fiadorApellido: null,
      fiadorDocumento: null,
      fiadorTelefono: null,
      estatus: "vigente",
      createdAt: new Date(),
      cliente: { id: 10, nombre: "Juan", apellido: "Perez", telefonoWhatsapp: "+59171160000" } as Cliente,
      ...overrides,
    } as Prestamo;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoCuentaService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Prestamo), useValue: mockPrestamoRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Abono), useValue: mockAbonoRepo },
        { provide: WHATSAPP_GATEWAY, useValue: mockGateway },
        { provide: NotificacionesService, useValue: mockNotificacionesService },
      ],
    }).compile();

    service = module.get(EstadoCuentaService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    prestamoRepo = module.get(getRepositoryToken(Prestamo));
    cuotaRepo = module.get(getRepositoryToken(Cuota));
    abonoRepo = module.get(getRepositoryToken(Abono));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(999, 5, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede ver el estado de cuenta de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.obtener(1, 5, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si el préstamo no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("obtener devuelve el estado de cuenta con cuotas, abonos y totales", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue(
      prestamoFixture(),
    );
    (cuotaRepo.find as jest.Mock).mockResolvedValue([
      { id: 11, numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01", estatus: "pagada" },
      { id: 12, numeroCuota: 2, valorEsperado: 100, fechaVencimiento: "2026-09-08", estatus: "pendiente" },
      { id: 13, numeroCuota: 3, valorEsperado: 100, fechaVencimiento: "2026-09-15", estatus: "pendiente" },
    ]);
    (abonoRepo.find as jest.Mock).mockResolvedValue([{ valor: 50 }, { valor: 25 }]);

    const result = await service.obtener(1, 5, adminContext);

    expect(result.prestamoId).toBe(5);
    expect(result.totalAbonos).toBe(75);
    expect(result.saldoPendiente).toBe(125);
    expect(result.proximoVencimiento).toBe("2026-09-08");
    expect(result.cuotas).toHaveLength(3);
    expect(result.cuotas.map((c) => c.cuotaId)).toEqual([11, 12, 13]);
    expect(result.moneda).toBe("BOB");
  });

  it("enviarReporte construye el texto y lo envía via gateway con emisor ia e intención reporte_estado_cuenta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue(
      prestamoFixture(),
    );
    (cuotaRepo.find as jest.Mock).mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01", estatus: "pendiente" },
    ]);
    (abonoRepo.find as jest.Mock).mockResolvedValue([]);
    mockNotificacionesService.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    const result = await service.enviarReporte(1, 5, adminContext);

    expect(result.conversacionId).toBe(7);
    expect(mockGateway.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({
        conversacionId: 7,
        emisor: "ia",
        intencionDetectada: "reporte_estado_cuenta",
        telefono: "+59171160000",
      }),
    );
    const mensajeEnviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(mensajeEnviado.contenido).toContain("Estado de cuenta");
    expect(mensajeEnviado.contenido).toContain("Juan");
  });

  it("enviarReporte no falla si no hay teléfono (envío sin destinatario por simular)", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue(
      prestamoFixture({
        cliente: { id: 10, nombre: "Juan", apellido: "Perez", telefonoWhatsapp: "" } as Cliente,
      }),
    );
    (cuotaRepo.find as jest.Mock).mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01", estatus: "pendiente" },
    ]);
    (abonoRepo.find as jest.Mock).mockResolvedValue([]);
    mockNotificacionesService.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    const result = await service.enviarReporte(1, 5, adminContext);

    expect(mockGateway.enviarMensaje).toHaveBeenCalledTimes(1);
    expect(result.conversacionId).toBe(7);
  });
});
