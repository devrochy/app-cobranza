import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConversacionIa } from "./conversacion-ia.entity";
import { MensajeIa } from "./mensaje-ia.entity";
import { WhatsappSimuladoGateway } from "./whatsapp-simulado.gateway";

describe("WhatsappSimuladoGateway", () => {
  let gateway: WhatsappSimuladoGateway;

  const mockConversacionRepo = { findOne: jest.fn() };
  const mockMensajeRepo = { create: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappSimuladoGateway,
        { provide: getRepositoryToken(ConversacionIa), useValue: mockConversacionRepo },
        { provide: getRepositoryToken(MensajeIa), useValue: mockMensajeRepo },
      ],
    }).compile();

    gateway = module.get(WhatsappSimuladoGateway);
  });

  it("enviarMensaje persiste un mensaje con emisor ia en la conversación", async () => {
    (mockMensajeRepo.create as jest.Mock).mockImplementation((e: Partial<MensajeIa>) => e as MensajeIa);
    (mockMensajeRepo.save as jest.Mock).mockImplementation(async (m: MensajeIa) => ({ ...m, id: 1 }));

    await gateway.enviarMensaje({
      conversacionId: 5,
      emisor: "ia",
      contenido: "Recordatorio de tu cuota",
      intencionDetectada: "recordatorio",
    });

    expect(mockMensajeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversacionId: 5,
        emisor: "ia",
        contenido: "Recordatorio de tu cuota",
        intencionDetectada: "recordatorio",
      }),
    );
    expect(mockMensajeRepo.save).toHaveBeenCalled();
  });

  it("recibirMensaje persiste un mensaje con emisor cliente", async () => {
    (mockMensajeRepo.create as jest.Mock).mockImplementation((e: Partial<MensajeIa>) => e as MensajeIa);
    (mockMensajeRepo.save as jest.Mock).mockImplementation(async (m: MensajeIa) => ({ ...m, id: 2 }));

    await gateway.recibirMensaje({
      conversacionId: 5,
      emisor: "cliente",
      contenido: "¿Cuál es mi saldo?",
    });

    expect(mockMensajeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ conversacionId: 5, emisor: "cliente", contenido: "¿Cuál es mi saldo?" }),
    );
  });
});