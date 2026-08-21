import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { Cuota } from "./cuota.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { MensajeIa } from "./mensaje-ia.entity";
import { WHATSAPP_GATEWAY } from "./whatsapp-gateway.interface";
import { NotificacionesService } from "./notificaciones.service";

describe("NotificacionesService", () => {
  let service: NotificacionesService;

  const mockCuotaRepo = { find: jest.fn() };
  const mockConversacionRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockMensajeRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
    })),
  };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockGateway = { enviarMensaje: jest.fn(), recibirMensaje: jest.fn() };

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

  it("envía recordatorio para cuotas que vencen dentro de N días y deduplica", async () => {
    const hoy = new Date("2026-08-19T12:00:00");
    // La BD filtra por fecha_vencimiento = objetivo (hoy + 3 = 2026-08-22),
    // así que `find` devuelve solo la cuota que vence en 3 días.
    mockCuotaRepo.find.mockResolvedValue([
      {
        id: 1,
        prestamoId: 10,
        fechaVencimiento: "2026-08-22",
        valorEsperado: 100,
        prestamo: { id: 10, cliente: { id: 5, nombre: "Juan", telefonoWhatsapp: "+591" } },
      },
    ]);
    mockConversacionRepo.findOne.mockResolvedValue({ id: 7, clienteId: 5 });
    mockGateway.enviarMensaje.mockResolvedValue({ id: 1 });
    mockConfigRepo.findOne.mockResolvedValue({ diasAnticipacionNotificacion: 3 } as RutaConfig);

    const enviadas = await service.ejecutarRecordatorios({ rutaId: 1, hoy });

    expect(mockGateway.enviarMensaje).toHaveBeenCalledTimes(1);
    expect(mockGateway.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ conversacionId: 7, emisor: "ia" }),
    );
    expect(enviadas).toBe(1);
  });

  it("crea la conversación si el cliente no tiene una activa", async () => {
    const hoy = new Date("2026-08-19T12:00:00");
    mockCuotaRepo.find.mockResolvedValue([
      {
        id: 1,
        prestamoId: 10,
        fechaVencimiento: "2026-08-22",
        valorEsperado: 100,
        prestamo: { id: 10, cliente: { id: 5, nombre: "Juan", telefonoWhatsapp: "+591" } },
      },
    ]);
    mockConversacionRepo.findOne.mockResolvedValue(null);
    mockConversacionRepo.create.mockImplementation((e: Partial<ConversacionIa>) => e as ConversacionIa);
    mockConversacionRepo.save.mockResolvedValue({ id: 8, clienteId: 5 });
    mockGateway.enviarMensaje.mockResolvedValue({ id: 1 });
    mockConfigRepo.findOne.mockResolvedValue({ diasAnticipacionNotificacion: 3 } as RutaConfig);

    await service.ejecutarRecordatorios({ rutaId: 1, hoy });

    expect(mockConversacionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 5, estado: "activa", canal: "whatsapp" }),
    );
    expect(mockGateway.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ conversacionId: 8 }),
    );
  });
});