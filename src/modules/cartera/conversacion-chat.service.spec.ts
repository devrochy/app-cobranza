import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { MensajeIa } from "./mensaje-ia.entity";
import { WHATSAPP_GATEWAY } from "./whatsapp-gateway.interface";
import { NotificacionesService } from "./notificaciones.service";
import { ConversacionChatService } from "./conversacion-chat.service";

describe("ConversacionChatService", () => {
  let service: ConversacionChatService;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockClienteRepo = { findOne: jest.fn() };
  const mockConversacionRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockMensajeRepo = { find: jest.fn() };
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversacionChatService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(ConversacionIa), useValue: mockConversacionRepo },
        { provide: getRepositoryToken(MensajeIa), useValue: mockMensajeRepo },
        { provide: WHATSAPP_GATEWAY, useValue: mockGateway },
        { provide: NotificacionesService, useValue: mockNotificacionesService },
      ],
    }).compile();

    service = module.get(ConversacionChatService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    clienteRepo = module.get(getRepositoryToken(Cliente));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtenerHistorial(999, 10, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede ver el historial de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.obtenerHistorial(1, 10, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si el cliente no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtenerHistorial(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("obtenerHistorial devuelve la conversación, sus mensajes y el enlace wa.me", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    mockNotificacionesService.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });
    mockMensajeRepo.find.mockResolvedValue([
      { id: 1, emisor: "cliente", contenido: "hola", timestamp: new Date() },
      { id: 2, emisor: "ia", contenido: "hola", timestamp: new Date() },
    ]);

    const result = await service.obtenerHistorial(1, 10, adminContext);

    expect(result.conversacion.id).toBe(7);
    expect(result.mensajes).toHaveLength(2);
    expect(result.waMe).toBe("https://wa.me/59171160000");
  });

  it("enviarMensajeAgente envía el mensaje del agente via gateway", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    mockNotificacionesService.obtenerConversacion.mockResolvedValue({ id: 7, clienteId: 10 });
    mockGateway.enviarMensaje.mockResolvedValue({ id: 1 });

    await service.enviarMensajeAgente(1, 10, "Estimado, por favor pague", adminContext);

    expect(mockGateway.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ conversacionId: 7, emisor: "agente", contenido: "Estimado, por favor pague" }),
    );
  });
});