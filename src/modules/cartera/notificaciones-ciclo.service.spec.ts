import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { MensajeIa } from "./mensaje-ia.entity";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { WHATSAPP_GATEWAY } from "./whatsapp-gateway.interface";
import { NotificacionesService } from "./notificaciones.service";

describe("NotificacionesService - ciclo completo", () => {
  let service: NotificacionesService;

  const mockCuotaRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockConversacionRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockMensajeRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
    })),
  };
  const mockGateway = { enviarMensaje: jest.fn(), recibirMensaje: jest.fn() };

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
      diasAnticipacionNotificacion: 3,
      avisoDiaCobro: true,
      umbralMoraNotificacion: 1,
      ...overrides,
    } as RutaConfig;
  }

  function cuotaFixture(overrides: Partial<Cuota> = {}): Cuota {
    return {
      id: 10,
      prestamoId: 20,
      numeroCuota: 1,
      valorEsperado: 100,
      fechaVencimiento: "2026-08-22",
      estatus: "pendiente",
      prestamo: { id: 20, cliente: { id: 5, nombre: "Juan", telefonoWhatsapp: "+591" } },
      ...overrides,
    } as Cuota;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(ConversacionIa), useValue: mockConversacionRepo },
        { provide: getRepositoryToken(MensajeIa), useValue: mockMensajeRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: WHATSAPP_GATEWAY, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(NotificacionesService);
  });

  it("envía el aviso del día de cobro a cuotas que vencen hoy si avisoDiaCobro está activo", async () => {
    const hoy = new Date("2026-08-19T12:00:00");
    mockConfigRepo.findOne.mockResolvedValue(configFixture());
    mockCuotaRepo.find.mockResolvedValue([cuotaFixture({ fechaVencimiento: "2026-08-19" })]);
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 5 });
    mockGateway.enviarMensaje.mockResolvedValue({ id: 1 });

    const enviadas = await service.ejecutarAvisoDiaCobro(1, { hoy });

    expect(mockGateway.enviarMensaje).toHaveBeenCalledTimes(1);
    expect(mockGateway.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ conversacionId: 7, emisor: "ia" }),
    );
    expect(enviadas).toBe(1);
  });

  it("no envía aviso del día si avisoDiaCobro está desactivado", async () => {
    const hoy = new Date("2026-08-19T12:00:00");
    mockConfigRepo.findOne.mockResolvedValue(configFixture({ avisoDiaCobro: false }));

    const enviadas = await service.ejecutarAvisoDiaCobro(1, { hoy });

    expect(mockGateway.enviarMensaje).not.toHaveBeenCalled();
    expect(enviadas).toBe(0);
  });

  it("deduplica: no reenvía si ya existe un mensaje del mismo tipo en la conversación ese día", async () => {
    const hoy = new Date("2026-08-19T12:00:00");
    mockConfigRepo.findOne.mockResolvedValue(configFixture());
    mockCuotaRepo.find.mockResolvedValue([cuotaFixture({ fechaVencimiento: "2026-08-19" })]);
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 5 });
    // Ya existe un mensaje del tipo ese día → no reenvía.
    (mockMensajeRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(true),
    });

    const enviadas = await service.ejecutarAvisoDiaCobro(1, { hoy });

    expect(mockGateway.enviarMensaje).not.toHaveBeenCalled();
    expect(enviadas).toBe(0);
  });

  it("envía confirmación de pago al cliente", async () => {
    (mockMensajeRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
    });
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 5 });
    mockGateway.enviarMensaje.mockResolvedValue({ id: 1 });

    await service.enviarConfirmacionPago({ id: 5, nombre: "Juan", telefonoWhatsapp: "+591" } as Cliente, 100);

    expect(mockGateway.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ conversacionId: 7, emisor: "ia", contenido: expect.stringContaining("confirm") }),
    );
  });

  it("envía alerta de mora a clientes con atraso >= umbral de la ruta", async () => {
    (mockMensajeRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
    });
    const hoy = new Date("2026-08-19T12:00:00");
    mockConfigRepo.findOne.mockResolvedValue(configFixture({ umbralMoraNotificacion: 1 }));
    mockCuotaRepo.find.mockResolvedValue([
      cuotaFixture({ estatus: "atrasada" }),
      cuotaFixture({ estatus: "atrasada", id: 11, numeroCuota: 2 }),
    ]);
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 5 });
    mockGateway.enviarMensaje.mockResolvedValue({ id: 1 });

    const enviadas = await service.ejecutarAlertaMora(1, { hoy });

    expect(mockGateway.enviarMensaje).toHaveBeenCalledTimes(1);
    expect(mockGateway.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ intencionDetectada: "alerta_mora" }),
    );
    expect(enviadas).toBe(1);
  });

  it("no envía alerta de mora si el atraso está bajo el umbral", async () => {
    const hoy = new Date("2026-08-19T12:00:00");
    mockConfigRepo.findOne.mockResolvedValue(configFixture({ umbralMoraNotificacion: 2 }));
    mockCuotaRepo.find.mockResolvedValue([cuotaFixture({ estatus: "atrasada" })]);
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 5 });

    const enviadas = await service.ejecutarAlertaMora(1, { hoy });

    expect(mockGateway.enviarMensaje).not.toHaveBeenCalled();
    expect(enviadas).toBe(0);
  });
});