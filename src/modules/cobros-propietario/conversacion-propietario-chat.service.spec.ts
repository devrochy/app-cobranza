import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Propietario } from "../propietarios/propietario.entity";
import { ConversacionPropietario } from "./conversacion-propietario.entity";
import { MensajePropietario } from "./mensaje-propietario.entity";
import { NotificacionesPropietarioService } from "./notificaciones-propietario.service";
import { ConversacionPropietarioChatService } from "./conversacion-propietario-chat.service";

describe("ConversacionPropietarioChatService", () => {
  let service: ConversacionPropietarioChatService;
  let propietarioRepo: Repository<Propietario>;
  let mensajeRepo: Repository<MensajePropietario>;
  let conversacionRepo: Repository<ConversacionPropietario>;
  let notificaciones: NotificacionesPropietarioService;

  const adminCtx = { rol: "admin" as const, sub: 0 };
  const propietarioCtx = { rol: "propietario" as const, sub: 1 };

  const propietario = (overrides: Partial<{ id: number; nombre: string; apellido: string; telefono: string | null }> = {}) =>
    ({
      id: 1,
      nombre: "Ana",
      apellido: "Ruiz",
      telefono: "+59170000001",
      ...overrides,
    }) as Propietario;

  const conversacion = (overrides: Partial<ConversacionPropietario> = {}) =>
    ({ id: 7, propietarioId: 1, estado: "activa", ...overrides }) as ConversacionPropietario;

  const mensaje = (overrides: Partial<MensajePropietario> = {}) =>
    ({
      id: 1,
      conversacionId: 7,
      emisor: "sistema",
      contenido: "Recordatorio",
      tipo: "notificacion_cobro",
      subtipo: "recordatorio",
      timestamp: new Date("2026-08-12T00:00:00Z"),
      ...overrides,
    }) as MensajePropietario;

  const mockPropietarioRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockMensajeRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((e: Partial<MensajePropietario>) => e as MensajePropietario),
    save: jest.fn(async (e: Partial<MensajePropietario>) => ({ ...mensaje(), ...e } as MensajePropietario)),
  };
  const mockConversacionRepo = { findOne: jest.fn() };
  const mockNotificaciones = {
    obtenerConversacion: jest.fn().mockResolvedValue(conversacion()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversacionPropietarioChatService,
        { provide: getRepositoryToken(Propietario), useValue: mockPropietarioRepo },
        { provide: getRepositoryToken(MensajePropietario), useValue: mockMensajeRepo },
        { provide: getRepositoryToken(ConversacionPropietario), useValue: mockConversacionRepo },
        { provide: NotificacionesPropietarioService, useValue: mockNotificaciones },
      ],
    }).compile();

    service = module.get(ConversacionPropietarioChatService);
    propietarioRepo = module.get(getRepositoryToken(Propietario));
    mensajeRepo = module.get(getRepositoryToken(MensajePropietario));
    conversacionRepo = module.get(getRepositoryToken(ConversacionPropietario));
    notificaciones = module.get(NotificacionesPropietarioService);
  });

  describe("listarConversaciones", () => {
    it("devuelve cada propietario con waMe y su último mensaje", async () => {
      (propietarioRepo.find as jest.Mock).mockResolvedValue([propietario(), propietario({ id: 2, nombre: "Luis", telefono: null })]);
      (conversacionRepo.findOne as jest.Mock).mockResolvedValue(conversacion({ id: 7 }));
      (mensajeRepo.findOne as jest.Mock).mockResolvedValue(mensaje({ id: 9, contenido: "Hola" }));

      const result = await service.listarConversaciones();

      expect(result).toHaveLength(2);
      expect(result[0].waMe).toBe("https://wa.me/59170000001");
      expect(result[0].ultimoMensaje?.contenido).toBe("Hola");
      expect(result[1].waMe).toBeNull();
    });

    it("devuelve ultimoMensaje null si el propietario no tiene conversación", async () => {
      (propietarioRepo.find as jest.Mock).mockResolvedValue([propietario()]);
      (conversacionRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.listarConversaciones();

      expect(result[0].ultimoMensaje).toBeNull();
    });
  });

  describe("obtenerHistorial", () => {
    it("devuelve la conversación, sus mensajes ordenados y el waMe (admin)", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietario());
      (mensajeRepo.find as jest.Mock).mockResolvedValue([
        mensaje({ id: 1, timestamp: new Date("2026-08-12T00:00:00Z") }),
        mensaje({ id: 2, emisor: "admin", contenido: "Hola", tipo: "manual", subtipo: null, timestamp: new Date("2026-08-13T00:00:00Z") }),
      ]);

      const result = await service.obtenerHistorial(1, adminCtx);

      expect(notificaciones.obtenerConversacion).toHaveBeenCalledWith(1);
      expect(result.conversacion.id).toBe(7);
      expect(result.propietario.nombre).toBe("Ana");
      expect(result.waMe).toBe("https://wa.me/59170000001");
      expect(result.mensajes).toHaveLength(2);
      expect(mensajeRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { timestamp: "ASC" } }),
      );
    });

    it("un propietario ve su propia conversación", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietario());
      (mensajeRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.obtenerHistorial(1, propietarioCtx);

      expect(result.conversacion.id).toBe(7);
    });

    it("un propietario no ve la conversación de otro (403)", async () => {
      await expect(service.obtenerHistorial(2, propietarioCtx)).rejects.toThrow(ForbiddenException);
      expect(propietarioRepo.findOne).not.toHaveBeenCalled();
    });

    it("un gestor no accede (403)", async () => {
      await expect(service.obtenerHistorial(1, { rol: "gestor", sub: 5 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("lanza NotFound si el propietario no existe", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.obtenerHistorial(999, adminCtx)).rejects.toThrow(NotFoundException);
    });
  });

  describe("enviarMensaje", () => {
    it("admin envía un mensaje manual con emisor admin", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietario());

      const result = await service.enviarMensaje(1, "Hola, por favor regulariza", adminCtx);

      expect(result.emisor).toBe("admin");
      expect(result.tipo).toBe("manual");
      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajePropietario>;
      expect(guardado.conversacionId).toBe(7);
      expect(guardado.contenido).toBe("Hola, por favor regulariza");
    });

    it("un propietario responde en su propia conversación con emisor propietario", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietario());

      const result = await service.enviarMensaje(1, "Ya pago mañana", propietarioCtx);

      expect(result.emisor).toBe("propietario");
    });

    it("un propietario no envía mensajes en conversación ajena (403)", async () => {
      await expect(service.enviarMensaje(2, "Hola", propietarioCtx)).rejects.toThrow(ForbiddenException);
    });
  });
});