import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CobroSocio } from "./cobro-socio.entity";
import { ConversacionSocio } from "./conversacion-socio.entity";
import { MensajeSocio } from "./mensaje-socio.entity";
import { NotificacionesSocioService } from "./notificaciones-socio.service";

describe("NotificacionesSocioService", () => {
  let service: NotificacionesSocioService;
  let cobroRepo: Repository<CobroSocio>;
  let conversacionRepo: Repository<ConversacionSocio>;
  let mensajeRepo: Repository<MensajeSocio>;

  const socio = (overrides: Partial<{ id: number; diasAnticipacionCobro: number }> = {}) =>
    ({ id: 1, diasAnticipacionCobro: 3, ...overrides }) as never;

  const cobro = (overrides: Partial<CobroSocio> = {}) =>
    ({
      id: 1,
      socioId: 1,
      periodo: "2026-08",
      montoCalculado: 550,
      fechaVencimiento: "2026-08-15",
      estado: "pendiente",
      socio: socio(),
      ...overrides,
    }) as CobroSocio;

  const conversacion = (overrides: Partial<ConversacionSocio> = {}) =>
    ({ id: 7, socioId: 1, estado: "activa", ...overrides }) as ConversacionSocio;

  const mockCobroRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockConversacionRepo = {
    findOne: jest.fn(),
    create: jest.fn((e: Partial<ConversacionSocio>) => e as ConversacionSocio),
    save: jest.fn(async (e: Partial<ConversacionSocio>) => ({ ...conversacion(), ...e } as ConversacionSocio)),
  };
  const mockMensajeRepo = {
    create: jest.fn((e: Partial<MensajeSocio>) => e as MensajeSocio),
    save: jest.fn(async (e: Partial<MensajeSocio>) => e as MensajeSocio),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockMensajeRepo.createQueryBuilder as jest.Mock).mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
    }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesSocioService,
        { provide: getRepositoryToken(CobroSocio), useValue: mockCobroRepo },
        { provide: getRepositoryToken(ConversacionSocio), useValue: mockConversacionRepo },
        { provide: getRepositoryToken(MensajeSocio), useValue: mockMensajeRepo },
      ],
    }).compile();

    service = module.get(NotificacionesSocioService);
    cobroRepo = module.get(getRepositoryToken(CobroSocio));
    conversacionRepo = module.get(getRepositoryToken(ConversacionSocio));
    mensajeRepo = module.get(getRepositoryToken(MensajeSocio));
  });

  function configurarConversacionActiva(): void {
    (conversacionRepo.findOne as jest.Mock).mockResolvedValue(conversacion());
  }

  describe("ejecutarRecordatorios", () => {
    it("envía recordatorio a cobros que vencen dentro de diasAnticipacionCobro", async () => {
      const hoy = new Date("2026-08-12T00:00:00Z");
      configurarConversacionActiva();
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 1, fechaVencimiento: "2026-08-15" }),
        cobro({ id: 2, fechaVencimiento: "2026-08-30" }),
      ]);

      const enviadas = await service.ejecutarRecordatorios(hoy);

      expect(enviadas).toBe(1);
      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajeSocio>;
      expect(guardado.tipo).toBe("notificacion_cobro");
      expect(guardado.subtipo).toBe("recordatorio");
      expect(guardado.emisor).toBe("sistema");
      expect(guardado.conversacionId).toBe(7);
    });

    it("no envía si diasAnticipacionCobro es 0", async () => {
      const hoy = new Date("2026-08-12T00:00:00Z");
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 1, fechaVencimiento: "2026-08-12", socio: socio({ diasAnticipacionCobro: 0 }) }),
      ]);

      await service.ejecutarRecordatorios(hoy);

      expect(mensajeRepo.save).not.toHaveBeenCalled();
    });

    it("deduplica por subtipo y día", async () => {
      const hoy = new Date("2026-08-12T00:00:00Z");
      configurarConversacionActiva();
      (cobroRepo.find as jest.Mock).mockResolvedValue([cobro({ id: 1, fechaVencimiento: "2026-08-15" })]);
      (mockMensajeRepo.createQueryBuilder as jest.Mock).mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(true),
      }));

      const enviadas = await service.ejecutarRecordatorios(hoy);

      expect(enviadas).toBe(0);
      expect(mensajeRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("ejecutarAvisoDia", () => {
    it("envía aviso a cobros pendientes que vencen hoy", async () => {
      const hoy = new Date("2026-08-15T00:00:00Z");
      configurarConversacionActiva();
      (cobroRepo.find as jest.Mock).mockResolvedValue([cobro({ id: 1, fechaVencimiento: "2026-08-15" })]);

      const enviadas = await service.ejecutarAvisoDia(hoy);

      expect(enviadas).toBe(1);
      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajeSocio>;
      expect(guardado.subtipo).toBe("aviso_dia");
    });

    it("consulta solo pendientes que vencen hoy", async () => {
      const hoy = new Date("2026-08-15T00:00:00Z");
      (cobroRepo.find as jest.Mock).mockResolvedValue([]);
      await service.ejecutarAvisoDia(hoy);
      expect(cobroRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: "pendiente", fechaVencimiento: "2026-08-15" }),
        }),
      );
    });
  });

  describe("ejecutarAlertasVencidos", () => {
    it("envía alerta a cobros vencidos", async () => {
      const hoy = new Date("2026-08-16T00:00:00Z");
      configurarConversacionActiva();
      (cobroRepo.find as jest.Mock).mockResolvedValue([cobro({ id: 1, estado: "vencido" })]);

      const enviadas = await service.ejecutarAlertasVencidos(hoy);

      expect(enviadas).toBe(1);
      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajeSocio>;
      expect(guardado.subtipo).toBe("alerta_vencido");
    });
  });

  describe("confirmarPago", () => {
    it("persiste la confirmación del pago", async () => {
      configurarConversacionActiva();
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(cobro());

      await service.confirmarPago(1, 550);

      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajeSocio>;
      expect(guardado.subtipo).toBe("confirmacion_pago");
      expect(guardado.contenido).toContain("550");
    });

    it("no hace nada si el cobro no existe", async () => {
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(null);
      await service.confirmarPago(999, 550);
      expect(mensajeRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("obtenerConversacion", () => {
    it("reutiliza la conversación activa del socio", async () => {
      (conversacionRepo.findOne as jest.Mock).mockResolvedValue(conversacion({ id: 9 }));
      const conv = await service["obtenerConversacion"](1);
      expect(conv.id).toBe(9);
    });

    it("crea una conversación nueva si no existe activa", async () => {
      (conversacionRepo.findOne as jest.Mock).mockResolvedValue(null);
      const conv = await service["obtenerConversacion"](1);
      expect(conversacionRepo.save).toHaveBeenCalled();
      expect(conv.socioId).toBe(1);
    });
  });
});