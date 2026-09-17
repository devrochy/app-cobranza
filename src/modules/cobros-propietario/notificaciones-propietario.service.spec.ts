import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CobroPropietario } from "./cobro-propietario.entity";
import { ConversacionPropietario } from "./conversacion-propietario.entity";
import { MensajePropietario } from "./mensaje-propietario.entity";
import { NotificacionesPropietarioService } from "./notificaciones-propietario.service";

describe("NotificacionesPropietarioService", () => {
  let service: NotificacionesPropietarioService;
  let cobroRepo: Repository<CobroPropietario>;
  let conversacionRepo: Repository<ConversacionPropietario>;
  let mensajeRepo: Repository<MensajePropietario>;

  const propietario = (overrides: Partial<{ id: number; diasAnticipacionCobro: number }> = {}) =>
    ({ id: 1, diasAnticipacionCobro: 3, ...overrides }) as never;

  const cobro = (overrides: Partial<CobroPropietario> = {}) =>
    ({
      id: 1,
      propietarioId: 1,
      periodo: "2026-08",
      montoCalculado: 550,
      fechaVencimiento: "2026-08-15",
      estado: "pendiente",
      propietario: propietario(),
      ...overrides,
    }) as CobroPropietario;

  const conversacion = (overrides: Partial<ConversacionPropietario> = {}) =>
    ({ id: 7, propietarioId: 1, estado: "activa", ...overrides }) as ConversacionPropietario;

  const mockCobroRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockConversacionRepo = {
    findOne: jest.fn(),
    create: jest.fn((e: Partial<ConversacionPropietario>) => e as ConversacionPropietario),
    save: jest.fn(async (e: Partial<ConversacionPropietario>) => ({ ...conversacion(), ...e } as ConversacionPropietario)),
  };
  const mockMensajeRepo = {
    create: jest.fn((e: Partial<MensajePropietario>) => e as MensajePropietario),
    save: jest.fn(async (e: Partial<MensajePropietario>) => e as MensajePropietario),
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
        NotificacionesPropietarioService,
        { provide: getRepositoryToken(CobroPropietario), useValue: mockCobroRepo },
        { provide: getRepositoryToken(ConversacionPropietario), useValue: mockConversacionRepo },
        { provide: getRepositoryToken(MensajePropietario), useValue: mockMensajeRepo },
      ],
    }).compile();

    service = module.get(NotificacionesPropietarioService);
    cobroRepo = module.get(getRepositoryToken(CobroPropietario));
    conversacionRepo = module.get(getRepositoryToken(ConversacionPropietario));
    mensajeRepo = module.get(getRepositoryToken(MensajePropietario));
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
      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajePropietario>;
      expect(guardado.tipo).toBe("notificacion_cobro");
      expect(guardado.subtipo).toBe("recordatorio");
      expect(guardado.emisor).toBe("sistema");
      expect(guardado.conversacionId).toBe(7);
    });

    it("no envía si diasAnticipacionCobro es 0", async () => {
      const hoy = new Date("2026-08-12T00:00:00Z");
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 1, fechaVencimiento: "2026-08-12", propietario: propietario({ diasAnticipacionCobro: 0 }) }),
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
      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajePropietario>;
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
      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajePropietario>;
      expect(guardado.subtipo).toBe("alerta_vencido");
    });
  });

  describe("confirmarPago", () => {
    it("persiste la confirmación del pago", async () => {
      configurarConversacionActiva();
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(cobro());

      await service.confirmarPago(1, 550);

      const guardado = (mensajeRepo.save as jest.Mock).mock.calls[0][0] as Partial<MensajePropietario>;
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
    it("reutiliza la conversación activa del propietario", async () => {
      (conversacionRepo.findOne as jest.Mock).mockResolvedValue(conversacion({ id: 9 }));
      const conv = await service["obtenerConversacion"](1);
      expect(conv.id).toBe(9);
    });

    it("crea una conversación nueva si no existe activa", async () => {
      (conversacionRepo.findOne as jest.Mock).mockResolvedValue(null);
      const conv = await service["obtenerConversacion"](1);
      expect(conversacionRepo.save).toHaveBeenCalled();
      expect(conv.propietarioId).toBe(1);
    });
  });
});