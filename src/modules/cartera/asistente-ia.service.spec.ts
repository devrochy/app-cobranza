import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { Prestamo } from "./prestamo.entity";
import { Cuota } from "./cuota.entity";
import { Abono } from "./abono.entity";
import { PromesaPago } from "./promesa-pago.entity";
import { WHATSAPP_GATEWAY } from "./whatsapp-gateway.interface";
import { NotificacionesService } from "./notificaciones.service";
import { ReglasNegociacionIaService } from "../reglas-negociacion-ia/reglas-negociacion-ia.service";
import { AsistenteIaService } from "./asistente-ia.service";

describe("AsistenteIaService", () => {
  let service: AsistenteIaService;

  const mockClienteRepo = { findOne: jest.fn(), find: jest.fn() };
  const mockConversacionRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockPrestamoRepo = { find: jest.fn() };
  const mockCuotaRepo = { find: jest.fn() };
  const mockAbonoRepo = { find: jest.fn() };
  const mockPromesaRepo = { create: jest.fn(), save: jest.fn(), count: jest.fn() };
  const mockRutaRepo = { findOne: jest.fn() };
  const mockGateway = { enviarMensaje: jest.fn(), recibirMensaje: jest.fn() };
  const mockNotificaciones = { obtenerConversacion: jest.fn() };
  const mockReglasService = { obtener: jest.fn() };

  const REGLAS_VACIAS = {
    maxDiasProrroga: 0,
    minAbonoAceptablePct: 0,
    maxReprogramacionesPorCliente: 0,
    configuradoPor: null,
    vigenteDesde: null,
  };

  function clienteFixture(overrides: Partial<Cliente> = {}): Cliente {
    return {
      id: 10,
      rutaId: 1,
      nombre: "Juan",
      apellido: "Perez",
      negocio: "Tienda",
      telefonoWhatsapp: "+59171160000",
      ubicacion: { type: "Point", coordinates: [-63.1, -17.7] },
      ubicacionDomicilio: null,
      topeMaximoDeuda: null,
      estatus: "activo",
      colorRiesgo: "azul",
      createdAt: new Date(),
      ...overrides,
    } as Cliente;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReglasService.obtener.mockResolvedValue(REGLAS_VACIAS);
    mockPromesaRepo.count.mockResolvedValue(0);
    mockConversacionRepo.save.mockImplementation((e) => Promise.resolve(e));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsistenteIaService,
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(ConversacionIa), useValue: mockConversacionRepo },
        { provide: getRepositoryToken(Prestamo), useValue: mockPrestamoRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Abono), useValue: mockAbonoRepo },
        { provide: getRepositoryToken(PromesaPago), useValue: mockPromesaRepo },
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: WHATSAPP_GATEWAY, useValue: mockGateway },
        { provide: NotificacionesService, useValue: mockNotificaciones },
        { provide: ReglasNegociacionIaService, useValue: mockReglasService },
      ],
    }).compile();

    service = module.get(AsistenteIaService);
  });

  it("responde con el saldo agregado y la próxima cuota ante consulta_saldo", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([
      { id: 5, valor: 300, numCuotas: 3, tipoInteres: 0, estatus: "vigente" },
    ]);
    mockCuotaRepo.find.mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01", estatus: "pagada" },
      { numeroCuota: 2, valorEsperado: 100, fechaVencimiento: "2026-09-08", estatus: "pendiente" },
    ]);
    mockAbonoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "cuál es mi saldo" });

    expect(mockGateway.enviarMensaje).toHaveBeenCalledTimes(1);
    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.emisor).toBe("ia");
    expect(enviado.intencionDetectada).toBe("consulta_saldo");
    expect(enviado.contenido).toContain("100 BOB");
    expect(enviado.contenido).toContain("#2");
  });

  it("resuelve el cliente por teléfono cuando no hay conversacionId", async () => {
    mockClienteRepo.find.mockResolvedValue([clienteFixture()]);
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    await service.procesarMensaje({ telefono: "+59171160000", contenido: "saldo" });

    expect(mockClienteRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ telefonoWhatsapp: "+59171160000" }) }),
    );
    expect(mockGateway.enviarMensaje).toHaveBeenCalledTimes(1);
  });

  it("no responde si el teléfono está compartido por varios clientes (evita fuga de datos)", async () => {
    mockClienteRepo.find.mockResolvedValue([clienteFixture(), clienteFixture({ id: 11 })]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    await service.procesarMensaje({ telefono: "+59171160000", contenido: "saldo" });

    expect(mockGateway.enviarMensaje).not.toHaveBeenCalled();
  });

  it("no envía nada si la conversación existe pero el cliente no", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 999 });
    mockClienteRepo.findOne.mockResolvedValue(null);

    await service.procesarMensaje({ conversacionId: 7, contenido: "saldo" });

    expect(mockGateway.enviarMensaje).not.toHaveBeenCalled();
  });

  it("no envía nada si no se puede resolver el cliente", async () => {
    mockConversacionRepo.findOne.mockResolvedValue(null);
    mockClienteRepo.findOne.mockResolvedValue(null);

    await service.procesarMensaje({ contenido: "saldo" });

    expect(mockGateway.enviarMensaje).not.toHaveBeenCalled();
  });

  it("responde el fallback genérico para intención desconocida", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "hola buenas tardes" });

    expect(mockGateway.enviarMensaje).toHaveBeenCalledTimes(1);
    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.intencionDetectada).toBe("desconocida");
    expect(enviado.contenido).toContain("No entendí");
  });

  it("agrega el saldo de varios préstamos vigentes y elige la próxima cuota más próxima", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([
      { id: 5, valor: 200, numCuotas: 2, tipoInteres: 0, estatus: "vigente" },
      { id: 6, valor: 100, numCuotas: 1, tipoInteres: 0, estatus: "vigente" },
    ]);
    mockCuotaRepo.find.mockImplementation((opts: { where: { prestamo: { id: number } } }) => {
      const prestamoId = opts.where.prestamo.id;
      if (prestamoId === 5) {
        return Promise.resolve([
          { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01", estatus: "pendiente" },
          { numeroCuota: 2, valorEsperado: 100, fechaVencimiento: "2026-09-15", estatus: "pendiente" },
        ]);
      }
      return Promise.resolve([
        { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-08", estatus: "pendiente" },
      ]);
    });
    mockAbonoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "saldo" });

    expect(mockGateway.enviarMensaje).toHaveBeenCalledTimes(1);
    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.contenido).toContain("300 BOB");
    expect(enviado.contenido).toContain("2026-09-01");
  });

  it("registra la promesa con monto explícito y la confirma (promesa_pago)", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([
      { id: 5, valor: 100, numCuotas: 1, tipoInteres: 0, estatus: "vigente" },
    ]);
    mockCuotaRepo.find.mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2099-01-01", estatus: "pendiente" },
    ]);
    mockAbonoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });
    mockPromesaRepo.create.mockImplementation((e) => e as PromesaPago);
    mockPromesaRepo.save.mockResolvedValue({ id: 1 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "pago 100 el lunes" });

    expect(mockPromesaRepo.save).toHaveBeenCalledTimes(1);
    const guardada = mockPromesaRepo.save.mock.calls[0][0];
    expect(guardada.prestamoId).toBe(5);
    expect(guardada.creadoPor).toBe("ia");
    expect(guardada.estado).toBe("pendiente");
    expect(guardada.conversacionId).toBe(7);
    expect(guardada.valorPrometido).toBe(100);
    expect(guardada.tipo).toBe("promesa");

    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.intencionDetectada).toBe("promesa_pago");
    expect(enviado.contenido).toContain("promesa");
  });

  it("usa el valor de la cuota pendiente como monto si el cliente no lo menciona", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([
      { id: 5, valor: 100, numCuotas: 1, tipoInteres: 0, estatus: "vigente" },
    ]);
    mockCuotaRepo.find.mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2099-01-01", estatus: "pendiente" },
    ]);
    mockAbonoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });
    mockPromesaRepo.create.mockImplementation((e) => e as PromesaPago);
    mockPromesaRepo.save.mockResolvedValue({ id: 1 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "pago el viernes" });

    expect(mockPromesaRepo.save).toHaveBeenCalledTimes(1);
    expect(mockPromesaRepo.save.mock.calls[0][0].valorPrometido).toBe(100);
  });

  it("pide aclaración y no persiste cuando no hay fecha parseable", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "quiero pagar" });

    expect(mockPromesaRepo.save).not.toHaveBeenCalled();
    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.intencionDetectada).toBe("promesa_pago_clarificacion");
  });

  it("registra un acuerdo de abono parcial con tipo abono_parcial", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([
      { id: 5, valor: 100, numCuotas: 1, tipoInteres: 0, estatus: "vigente" },
    ]);
    mockCuotaRepo.find.mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2099-01-01", estatus: "pendiente" },
    ]);
    mockAbonoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });
    mockPromesaRepo.create.mockImplementation((e) => e as PromesaPago);
    mockPromesaRepo.save.mockResolvedValue({ id: 1 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "puedo abonar 100 el viernes" });

    expect(mockPromesaRepo.save).toHaveBeenCalledTimes(1);
    const guardada = mockPromesaRepo.save.mock.calls[0][0];
    expect(guardada.tipo).toBe("abono_parcial");
    expect(guardada.valorPrometido).toBe(100);

    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.contenido.toLowerCase()).toContain("abono");
  });

  it("registra un acuerdo de refinanciación con tipo refinanciacion", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([
      { id: 5, valor: 100, numCuotas: 1, tipoInteres: 0, estatus: "vigente" },
    ]);
    mockCuotaRepo.find.mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2099-01-01", estatus: "pendiente" },
    ]);
    mockAbonoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });
    mockPromesaRepo.create.mockImplementation((e) => e as PromesaPago);
    mockPromesaRepo.save.mockResolvedValue({ id: 1 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "quiero refinanciar el viernes" });

    expect(mockPromesaRepo.save).toHaveBeenCalledTimes(1);
    const guardada = mockPromesaRepo.save.mock.calls[0][0];
    expect(guardada.tipo).toBe("refinanciacion");

    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.contenido.toLowerCase()).toContain("refinanciación");
  });

  it("rechaza la negociación y NO persiste cuando excede las reglas", async () => {
    mockReglasService.obtener.mockResolvedValue({ ...REGLAS_VACIAS, minAbonoAceptablePct: 90 });
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([
      { id: 5, valor: 100, numCuotas: 1, tipoInteres: 0, estatus: "vigente" },
    ]);
    mockCuotaRepo.find.mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2099-01-01", estatus: "pendiente" },
    ]);
    mockAbonoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });
    mockPromesaRepo.create.mockImplementation((e) => e as PromesaPago);
    mockPromesaRepo.save.mockResolvedValue({ id: 1 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "puedo abonar 10 el viernes" });

    expect(mockPromesaRepo.save).not.toHaveBeenCalled();
    expect(mockPromesaRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipo: "refinanciacion",
          prestamo: expect.objectContaining({ cliente: expect.objectContaining({ id: 10 }) }),
        }),
      }),
    );
    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.intencionDetectada).toBe("promesa_pago_rechazada");
    expect(enviado.contenido.toLowerCase()).toContain("límites");
  });

  it("deriva la conversación a un agente humano cuando el mensaje lo requiere", async () => {
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "quiero hablar con un agente" });

    expect(mockConversacionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        estado: "derivada",
        motivoDerivacion: "solicitud_agente",
        agenteAsignadoId: null,
      }),
    );
    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.intencionDetectada).toBe("derivacion");
    expect(enviado.contenido.toLowerCase()).toContain("agente");
  });

  it("deriva la negociación a humano cuando el saldo supera el umbral de decisión autónoma", async () => {
    mockReglasService.obtener.mockResolvedValue({ ...REGLAS_VACIAS, umbralSaldoAutonomo: 50 });
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 10 });
    mockClienteRepo.findOne.mockResolvedValue(clienteFixture());
    mockRutaRepo.findOne.mockResolvedValue({ id: 1, moneda: "BOB" } as Ruta);
    mockPrestamoRepo.find.mockResolvedValue([
      { id: 5, valor: 100, numCuotas: 1, tipoInteres: 0, estatus: "vigente" },
    ]);
    mockCuotaRepo.find.mockResolvedValue([
      { numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2099-01-01", estatus: "pendiente" },
    ]);
    mockAbonoRepo.find.mockResolvedValue([]);
    mockNotificaciones.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });
    mockPromesaRepo.create.mockImplementation((e) => e as PromesaPago);
    mockPromesaRepo.save.mockResolvedValue({ id: 1 });

    await service.procesarMensaje({ conversacionId: 7, contenido: "pago el viernes" });

    expect(mockPromesaRepo.save).not.toHaveBeenCalled();
    expect(mockConversacionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "derivada", motivoDerivacion: "saldo_supera_umbral" }),
    );
    const enviado = mockGateway.enviarMensaje.mock.calls[0][0];
    expect(enviado.intencionDetectada).toBe("derivacion");
  });
});
