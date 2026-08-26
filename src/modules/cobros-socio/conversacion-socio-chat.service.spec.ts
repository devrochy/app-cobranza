import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Socio } from "../socios/socio.entity";
import { ConversacionSocio } from "./conversacion-socio.entity";
import { MensajeSocio } from "./mensaje-socio.entity";
import { NotificacionesSocioService } from "./notificaciones-socio.service";
import { ConversacionSocioChatService } from "./conversacion-socio-chat.service";

describe("ConversacionSocioChatService", () => {
  let service: ConversacionSocioChatService;
  let socioRepo: Repository<Socio>;
  let mensajeRepo: Repository<MensajeSocio>;
  let conversacionRepo: Repository<ConversacionSocio>;
  let notificaciones: NotificacionesSocioService;

  const adminCtx = { rol: "admin" as const, sub: 0 };
  const socioCtx = { rol: "socio" as const, sub: 1 };

  const socio = (overrides: Partial<{ id: number; nombre: string; apellido: string; telefono: string | null }> = {}) =>
    ({
      id: 1,
      nombre: "Ana",
      apellido: "Ruiz",
      telefono: "+59170000001",
      ...overrides,
    }) as Socio;

  const conversacion = (overrides: Partial<ConversacionSocio> = {}) =>
    ({ id: 7, socioId: 1, estado: "activa", ...overrides }) as ConversacionSocio;

  const mensaje = (overrides: Partial<MensajeSocio> = {}) =>
    ({
      id: 1,
      conversacionId: 7,
      emisor: "sistema",
      contenido: "Recordatorio",
      tipo: "notificacion_cobro",
      subtipo: "recordatorio",
      timestamp: new Date("2026-08-12T00:00:00Z"),
      ...overrides,
    }) as MensajeSocio;

  const mockSocioRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockMensajeRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((e: Partial<MensajeSocio>) => e as MensajeSocio),
    save: jest.fn(async (e: Partial<MensajeSocio>) => ({ ...mensaje(), ...e } as MensajeSocio)),
  };
  const mockConversacionRepo = { findOne: jest.fn() };
  const mockNotificaciones = {
    obtenerConversacion: jest.fn().mockResolvedValue(conversacion()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversacionSocioChatService,
        { provide: getRepositoryToken(Socio), useValue: mockSocioRepo },
        { provide: getRepositoryToken(MensajeSocio), useValue: mockMensajeRepo },
        { provide: getRepositoryToken(ConversacionSocio), useValue: mockConversacionRepo },
        { provide: NotificacionesSocioService, useValue: mockNotificaciones },
      ],
    }).compile();

    service = module.get(ConversacionSocioChatService);
    socioRepo = module.get(getRepositoryToken(Socio));
    mensajeRepo = module.get(getRepositoryToken(MensajeSocio));
    conversacionRepo = module.get(getRepositoryToken(ConversacionSocio));
    notificaciones = module.get(NotificacionesSocioService);
  });

  describe("listarConversaciones", () => {
    it("devuelve cada socio con waMe y su último mensaje", async () => {
      (socioRepo.find as jest.Mock).mockResolvedValue([socio(), socio({ id: 2, nombre: "Luis", telefono: null })]);
      (conversacionRepo.findOne as jest.Mock).mockResolvedValue(conversacion({ id: 7 }));
      (mensajeRepo.findOne as jest.Mock).mockResolvedValue(mensaje({ id: 9, contenido: "Hola" }));

      const result = await service.listarConversaciones();

      expect(result).toHaveLength(2);
      expect(result[0].waMe).toBe("https://wa.me/59170000001");
      expect(result[0].ultimoMensaje?.contenido).toBe("Hola");
      expect(result[1].waMe).toBeNull();
    });

    it("devuelve ultimoMensaje null si el socio no tiene conversación", async () => {
      (socioRepo.find as jest.Mock).mockResolvedValue([socio()]);
      (conversacionRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.listarConversaciones();

      expect(result[0].ultimoMensaje).toBeNull();
    });
  });

  describe("obtenerHistorial", () => {
    it("devuelve la conversación, sus mensajes ordenados y el waMe (admin)", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socio());
      (mensajeRepo.find as jest.Mock).mockResolvedValue([
        mensaje({ id: 1, timestamp: new Date("2026-08-12T00:00:00Z") }),
        mensaje({ id: 2, emisor: "admin", contenido: "Hola", tipo: "manual", subtipo: null, timestamp: new Date("2026-08-13T00:00:00Z") }),
      ]);

      const result = await service.obtenerHistorial(1, adminCtx);

      expect(notificaciones.obtenerConversacion).toHaveBeenCalledWith(1);
      expect(result.conversacion.id).toBe(7);
      expect(result.socio.nombre).toBe("Ana");
      expect(result.waMe).toBe("https://wa.me/59170000001");
      expect(result.mensajes).toHaveLength(2);
      expect(mensajeRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { timestamp: "ASC" } }),
      );
    });

    it("un socio ve su propia conversación", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socio());
      (mensajeRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.obtenerHistorial(1, socioCtx);

      expect(result.conversacion.id).toBe(7);
    });

    it("un socio no ve la conversación de otro (403)", async () => {
      await expect(service.obtenerHistorial(2, socioCtx)).rejects.toThrow(ForbiddenException);
      expect(socioRepo.findOne).not.toHaveBeenCalled();
    });

    it("un cobrador no accede (403)", async () => {
      await expect(service.obtenerHistorial(1, { rol: "cobrador", sub: 5 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("lanza NotFound si el socio no existe", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.obtenerHistorial(999, adminCtx)).rejects.toThrow(NotFoundException);
    });
  });

  describe("enviarMensaje", () => {
    it("admin envía un mensaje manual con emisor admin", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socio());

      const result = await service.enviarMensaje(1, "Hola, por favor regulariza", adminCtx);

      expect(result.emisor).toBe("admin");
      expect(result.tipo).toBe("manual");
      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajeSocio>;
      expect(guardado.conversacionId).toBe(7);
      expect(guardado.contenido).toBe("Hola, por favor regulariza");
    });

    it("un socio responde en su propia conversación con emisor socio", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socio());

      const result = await service.enviarMensaje(1, "Ya pago mañana", socioCtx);

      expect(result.emisor).toBe("socio");
    });

    it("un socio no envía mensajes en conversación ajena (403)", async () => {
      await expect(service.enviarMensaje(2, "Hola", socioCtx)).rejects.toThrow(ForbiddenException);
    });
  });
});