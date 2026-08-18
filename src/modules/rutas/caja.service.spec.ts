import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Caja } from "./caja.entity";
import { CajaAjusteLog } from "./caja-ajuste-log.entity";
import { CajaService, TipoMovimientoCaja } from "./caja.service";
import { Ruta } from "./ruta.entity";

describe("CajaService", () => {
  let service: CajaService;
  let cajaRepo: Repository<Caja>;
  let logRepo: Repository<CajaAjusteLog>;
  let rutaRepo: Repository<Ruta>;

  const mockCajaRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockLogRepo = { create: jest.fn(), save: jest.fn() };
  const mockRutaRepo = { findOne: jest.fn() };

  const actor = { rol: "socio" as const, sub: 7 };
  const adminActor = { rol: "admin" as const, sub: 0 };

  function cajaFixture(overrides: Partial<Caja> = {}): Caja {
    return {
      id: 1,
      rutaId: 1,
      saldoInicial: 1000,
      saldoActual: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as Caja;
  }

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajaService,
        { provide: getRepositoryToken(Caja), useValue: mockCajaRepo },
        { provide: getRepositoryToken(CajaAjusteLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
      ],
    }).compile();

    service = module.get(CajaService);
    cajaRepo = module.get(getRepositoryToken(Caja));
    logRepo = module.get(getRepositoryToken(CajaAjusteLog));
    rutaRepo = module.get(getRepositoryToken(Ruta));
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
      expect(caja.rutaId).toBe(5);
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
          actorRol: "socio",
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
  });

  describe("consultar", () => {
    it("devuelve saldo inicial, actual y timestamps", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(cajaFixture({ saldoInicial: 1000, saldoActual: 1500 }));

      const res = await service.consultar(1, adminActor);

      expect(res.rutaId).toBe(1);
      expect(res.saldoInicial).toBe(1000);
      expect(res.saldoActual).toBe(1500);
    });

    it("un socio no puede consultar la caja de una ruta ajena -> 403", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

      await expect(service.consultar(1, actor)).rejects.toThrow(ForbiddenException);
    });

    it("lanza NotFoundException si la caja no existe", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (cajaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.consultar(99, adminActor)).rejects.toThrow(NotFoundException);
    });
  });
});
