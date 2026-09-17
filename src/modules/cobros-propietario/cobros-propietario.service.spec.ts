import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { CobroPropietario } from "./cobro-propietario.entity";
import { LinkPago } from "./link-pago.entity";
import { CobrosPropietarioService } from "./cobros-propietario.service";
import { PropietarioMoraService } from "./propietario-mora.service";

describe("CobrosPropietarioService", () => {
  let service: CobrosPropietarioService;
  let propietarioRepo: Repository<Propietario>;
  let carteraRepo: Repository<Cartera>;
  let cobroRepo: Repository<CobroPropietario>;
  let linkRepo: Repository<LinkPago>;

  const propietarioActivo = (overrides: Partial<Propietario> = {}): Propietario =>
    ({
      id: 1,
      estatus: "activo",
      moneda: "BOB",
      diasAnticipacionCobro: 3,
      createdAt: new Date("2026-01-15T00:00:00Z"),
      ...overrides,
    }) as Propietario;

  const cartera = (overrides: Partial<Cartera> = {}): Cartera =>
    ({ id: 1, propietarioId: 1, estatus: "activo", costoCobro: 250, ...overrides }) as Cartera;

  const cobro = (overrides: Partial<CobroPropietario> = {}): CobroPropietario =>
    ({
      id: 1,
      propietarioId: 1,
      periodo: "2026-08",
      montoCalculado: 550,
      montoPagado: null,
      fechaVencimiento: "2026-08-15",
      fechaPago: null,
      estado: "pendiente",
      metodoPago: null,
      registradoPor: null,
      createdAt: new Date(),
      ...overrides,
    }) as CobroPropietario;

  const link = (overrides: Partial<LinkPago> = {}): LinkPago =>
    ({
      id: 1,
      cobroPropietarioId: 1,
      url: "https://pago.mock/cobros-propietario/1",
      estado: "generado",
      proveedor: "mock",
      createdAt: new Date(),
      ...overrides,
    }) as LinkPago;

  const mockPropietarioRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockCarteraRepo = { find: jest.fn() };
  const mockCobroRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((e: Partial<CobroPropietario>) => e as CobroPropietario),
    save: jest.fn(async (e: Partial<CobroPropietario>) => ({ ...cobro(), ...e } as CobroPropietario)),
    update: jest.fn(),
  };
  const mockLinkRepo = {
    create: jest.fn((e: Partial<LinkPago>) => e as LinkPago),
    save: jest.fn(async (e: Partial<LinkPago>) => ({ ...link(), ...e } as LinkPago)),
    update: jest.fn(),
  };
  const mockPropietarioMora = {
    habilitarSiSinMorosidad: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobrosPropietarioService,
        { provide: getRepositoryToken(Propietario), useValue: mockPropietarioRepo },
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(CobroPropietario), useValue: mockCobroRepo },
        { provide: getRepositoryToken(LinkPago), useValue: mockLinkRepo },
        { provide: PropietarioMoraService, useValue: mockPropietarioMora },
      ],
    }).compile();

    service = module.get(CobrosPropietarioService);
    propietarioRepo = module.get(getRepositoryToken(Propietario));
    carteraRepo = module.get(getRepositoryToken(Cartera));
    cobroRepo = module.get(getRepositoryToken(CobroPropietario));
    linkRepo = module.get(getRepositoryToken(LinkPago));
  });

  describe("calcularCobro", () => {
    it("suma el costo_cobro de las carteras activas del propietario", async () => {
      (carteraRepo.find as jest.Mock).mockResolvedValue([
        cartera({ id: 1, costoCobro: 250 }),
        cartera({ id: 2, costoCobro: 300 }),
      ]);

      const total = await service.calcularCobro(1);

      expect(carteraRepo.find).toHaveBeenCalledWith({
        where: { propietario: { id: 1 }, estatus: "activo" },
      });
      expect(total).toBe(550);
    });

    it("devuelve 0 si el propietario no tiene carteras activas", async () => {
      (carteraRepo.find as jest.Mock).mockResolvedValue([]);
      await expect(service.calcularCobro(1)).resolves.toBe(0);
    });
  });

  describe("generarCobrosDelDia", () => {
    // Ancla = 15, diasAnticipacionCobro = 3 → generación el 12 de cada mes.
    const hoy = new Date("2026-08-12T00:00:00Z");

    it("consulta solo propietarios activos", async () => {
      (propietarioRepo.find as jest.Mock).mockResolvedValue([]);
      await service.generarCobrosDelDia(hoy);
      expect(propietarioRepo.find).toHaveBeenCalledWith({ where: { estatus: "activo" } });
    });

    it("crea el cobro del periodo diasAnticipacion antes del vencimiento, con link mock", async () => {
      (propietarioRepo.find as jest.Mock).mockResolvedValue([propietarioActivo()]);
      (carteraRepo.find as jest.Mock).mockResolvedValue([cartera({ costoCobro: 250 }), cartera({ id: 2, costoCobro: 300 })]);
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(null);

      const creados = await service.generarCobrosDelDia(hoy);

      expect(creados).toBe(1);
      const saved = (cobroRepo.save as jest.Mock).mock.calls[0][0] as Partial<CobroPropietario>;
      expect(saved.propietarioId).toBe(1);
      expect(saved.periodo).toBe("2026-08");
      expect(saved.montoCalculado).toBe(550);
      expect(saved.fechaVencimiento).toBe("2026-08-15");
      expect(saved.estado).toBe("pendiente");
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cobroPropietarioId: 1, proveedor: "mock", estado: "generado" }),
      );
    });

    it("no crea nada si hoy no es el día de generación del propietario", async () => {
      (propietarioRepo.find as jest.Mock).mockResolvedValue([propietarioActivo()]);
      const otroDia = new Date("2026-08-14T00:00:00Z");
      await service.generarCobrosDelDia(otroDia);
      expect(cobroRepo.save).not.toHaveBeenCalled();
    });

    it("es idempotente: no crea si ya existe cobro para el propietario y periodo", async () => {
      (propietarioRepo.find as jest.Mock).mockResolvedValue([propietarioActivo()]);
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(cobro());
      await service.generarCobrosDelDia(hoy);
      expect(cobroRepo.save).not.toHaveBeenCalled();
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it("trata una violación de unicidad (23505) como cobro ya existente", async () => {
      (propietarioRepo.find as jest.Mock).mockResolvedValue([propietarioActivo()]);
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(null);
      (cobroRepo.save as jest.Mock).mockRejectedValue({ code: "23505" });

      const creados = await service.generarCobrosDelDia(hoy);

      expect(creados).toBe(0);
      expect(linkRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("generarCobro (manual)", () => {
    it("crea el cobro de un periodo arbitrario (clamp al último día)", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioActivo({ createdAt: new Date("2026-01-31T00:00:00Z") }));
      (carteraRepo.find as jest.Mock).mockResolvedValue([cartera({ costoCobro: 250 })]);
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(null);
      (cobroRepo.save as jest.Mock).mockImplementation(async (e: Partial<CobroPropietario>) => ({ ...cobro(), ...e }));

      const res = await service.generarCobro(1, "2026-02");

      expect(res.fechaVencimiento).toBe("2026-02-28");
      expect(res.montoCalculado).toBe(250);
    });

    it("lanza Conflict si el cobro del periodo ya existe", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioActivo());
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(cobro());
      await expect(service.generarCobro(1, "2026-08")).rejects.toThrow(ConflictException);
    });

    it("lanza NotFound si el propietario no existe", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.generarCobro(999, "2026-08")).rejects.toThrow(NotFoundException);
    });
  });

  describe("marcarVencidos", () => {
    const hoy = new Date("2026-08-16T00:00:00Z");

    it("marca como vencidos los cobros pendientes vencidos", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([cobro({ id: 1 }), cobro({ id: 2 })]);

      const marcados = await service.marcarVencidos(hoy);

      expect(cobroRepo.update).toHaveBeenCalledWith(1, { estado: "vencido" });
      expect(cobroRepo.update).toHaveBeenCalledWith(2, { estado: "vencido" });
      expect(marcados).toBe(2);
    });

    it("consulta solo pendientes con vencimiento anterior a hoy", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([]);
      await service.marcarVencidos(hoy);
      expect(cobroRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: "pendiente" }),
        }),
      );
    });
  });

  describe("registrarPago", () => {
    it("lanza NotFound si el cobro no existe", async () => {
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.registrarPago(999, { montoPagado: 550, metodoPago: "transferencia", registradoPor: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rechaza registrar pago de un cobro ya pagado", async () => {
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(cobro({ estado: "pagado" }));
      await expect(
        service.registrarPago(1, { montoPagado: 550, metodoPago: "transferencia", registradoPor: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("registra el pago y actualiza el link a pagado", async () => {
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(cobro());
      (linkRepo.update as jest.Mock).mockResolvedValue(undefined);

      const res = await service.registrarPago(1, {
        montoPagado: 500,
        metodoPago: "qr",
        fechaPago: "2026-08-12",
        registradoPor: 1,
      });

      expect(res.estado).toBe("pagado");
      expect(res.montoPagado).toBe(500);
      expect(res.metodoPago).toBe("qr");
      expect(res.fechaPago).toBe("2026-08-12");
      expect(linkRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        { estado: "pagado" },
      );
    });

    it("tras registrar el pago dispara la auto-habilitación por mora", async () => {
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(cobro());

      await service.registrarPago(1, {
        montoPagado: 500,
        metodoPago: "qr",
        registradoPor: 1,
      });

      expect(mockPropietarioMora.habilitarSiSinMorosidad).toHaveBeenCalledWith(1);
    });
  });

  describe("listar", () => {
    it("consulta con los filtros dados y ordena por periodo descendente", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([cobro()]);
      await service.listar({ propietarioId: 1, periodo: "2026-08", estado: "pendiente" });
      expect(cobroRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { propietario: { id: 1 }, periodo: "2026-08", estado: "pendiente" },
          order: { periodo: "DESC" },
        }),
      );
    });

    it("carga la relación linkPago para exponer el link de pago", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([{ ...cobro(), linkPago: link() }]);

      const res = await service.listar({ propietarioId: 1 });

      expect(cobroRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { linkPago: true } }),
      );
      expect(res[0].linkPago?.url).toBe("https://pago.mock/cobros-propietario/1");
    });
  });

  describe("obtener", () => {
    it("lanza NotFound si no existe", async () => {
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.obtener(999)).rejects.toThrow(NotFoundException);
    });

    it("devuelve el cobro con propietario y link", async () => {
      const conRelaciones = {
        ...cobro(),
        propietario: { id: 1, nombre: "Ana", apellido: "Ruiz", moneda: "BOB" },
        linkPago: link(),
      };
      (cobroRepo.findOne as jest.Mock).mockResolvedValue(conRelaciones);

      const res = await service.obtener(1);

      expect(res.propietario?.moneda).toBe("BOB");
      expect(res.linkPago?.estado).toBe("generado");
    });
  });
});