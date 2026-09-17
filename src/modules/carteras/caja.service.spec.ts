import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Caja } from "./caja.entity";
import { CajaAjusteLog } from "./caja-ajuste-log.entity";
import { CajaService, TipoMovimientoCaja } from "./caja.service";
import { Cartera } from "./cartera.entity";

describe("CajaService", () => {
  let service: CajaService;
  let cajaRepo: Repository<Caja>;
  let logRepo: Repository<CajaAjusteLog>;
  let carteraRepo: Repository<Cartera>;

  const mockCajaRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockLogRepo = { create: jest.fn(), save: jest.fn() };
  const mockCarteraRepo = { findOne: jest.fn() };

  const actor = { rol: "propietario" as const, sub: 7 };
  const adminActor = { rol: "admin" as const, sub: 0 };

  function cajaFixture(overrides: Partial<Caja> = {}): Caja {
    return {
      id: 1,
      carteraId: 1,
      saldoInicial: 1000,
      saldoActual: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as Caja;
  }

  function carteraFixture(overrides: Partial<Cartera> = {}): Cartera {
    return {
      id: 1,
      propietarioId: 1,
      gestorId: 1,
      nombre: "Cartera Centro",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Cartera;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajaService,
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(CajaAjusteLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
      ],
    }).compile();

    service = module.get(CajaService);
    cajaRepo = module.get(getRepositoryToken(Caja));
    logRepo = module.get(getRepositoryToken(CajaAjusteLog));
    carteraRepo = module.get(getRepositoryToken(Cartera));
  });

  describe("crearCaja", () => {
    it("crea una caja con saldo inicial = saldo actual", async () => {
      (cajaRepo.create as jest.Mock).mockImplementation((e: Partial<Caja>) => e as Caja);
      (cajaRepo.save as jest.Mock).mockImplementation(async (e: Partial<Caja>) => ({
        id: 1,
        ...e,
      }) as Caja);

      const caja = await service.crearCaja(5, 2500);

      expect(cajaRepo.save).toHaveBeenCalledTimes(1);
      expect(caja.carteraId).toBe(5);
      expect(caja.saldoInicial).toBe(2500);
      expect(caja.saldoActual).toBe(2500);
    });
  });

  describe("aplicarMovimiento", () => {
    it("aumenta el saldo actual y registra un log con valores anterior/nuevo y actor", async () => {
      const caja = cajaFixture({ saldoActual: 1000 });
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(caja);
      (cajaRepo.save as jest.Mock).mockImplementation(async (c: Caja) => c);
      (logRepo.create as jest.Mock).mockImplementation((e: Partial<CajaAjusteLog>) => e as CajaAjusteLog);

      await service.aplicarMovimiento(1, 500, TipoMovimientoCaja.INYECCION, actor, "Aporte");

      expect(caja.saldoActual).toBe(1500);
      expect(cajaRepo.save).toHaveBeenCalledWith(caja);
      expect(logRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cajaId: 1,
          valorAnterior: 1000,
          valorNuevo: 1500,
          motivo: "inyeccion: Aporte",
          actorRol: "propietario",
          actorId: 7,
        }),
      );
    });

    it("disminuye el saldo actual al eliminar una inyección", async () => {
      const caja = cajaFixture({ saldoActual: 1500 });
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(caja);
      (cajaRepo.save as jest.Mock).mockImplementation(async (c: Caja) => c);
      (logRepo.create as jest.Mock).mockImplementation((e: Partial<CajaAjusteLog>) => e as CajaAjusteLog);

      await service.aplicarMovimiento(1, -500, TipoMovimientoCaja.INYECCION_ELIMINADA, actor, "Revertir");

      expect(caja.saldoActual).toBe(1000);
    });

    it("lanza NotFoundException si la caja no existe", async () => {
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.aplicarMovimiento(99, 100, TipoMovimientoCaja.INYECCION, actor, "x"),
      ).rejects.toThrow(NotFoundException);
    });

    it("bloquea la fila de caja con pessimistic_write para evitar lost updates", async () => {
      const caja = cajaFixture({ saldoActual: 1000 });
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(caja);
      (cajaRepo.save as jest.Mock).mockImplementation(async (c: Caja) => c);
      (logRepo.create as jest.Mock).mockImplementation((e: Partial<CajaAjusteLog>) => e as CajaAjusteLog);

      await service.aplicarMovimiento(1, 100, TipoMovimientoCaja.PAGO, actor, "x");

      expect(cajaRepo.findOne).toHaveBeenCalledWith({
        where: { cartera: { id: 1 } },
        lock: { mode: "pessimistic_write" },
      });
    });
  });

  describe("consultar", () => {
    it("devuelve saldo inicial, actual y timestamps", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(cajaFixture({ saldoInicial: 1000, saldoActual: 1500 }));

      const res = await service.consultar(1, adminActor);

      expect(res.carteraId).toBe(1);
      expect(res.saldoInicial).toBe(1000);
      expect(res.saldoActual).toBe(1500);
    });

    it("un propietario no puede consultar la caja de una cartera ajena -> 403", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

      await expect(service.consultar(1, actor)).rejects.toThrow(ForbiddenException);
    });

    it("lanza NotFoundException si la caja no existe", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.consultar(99, adminActor)).rejects.toThrow(NotFoundException);
    });
  });
});
