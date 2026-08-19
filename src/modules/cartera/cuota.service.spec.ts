import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cuota } from "./cuota.entity";
import { Pago } from "./pago.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";
import { CuotaService } from "./cuota.service";
import { CajaService, TipoMovimientoCaja } from "../rutas/caja.service";
import { ReautenticacionService } from "../security/reautenticacion.service";

describe("CuotaService", () => {
  let service: CuotaService;
  let rutaRepo: Repository<Ruta>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let auditoriaRepo: Repository<AuditoriaCartera>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() };
  const mockPagoRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockReautenticacion = { validar: jest.fn() };
  const mockAuditoriaRepo = { create: jest.fn(), save: jest.fn() };
  const mockCajaService = { aplicarMovimiento: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        save: jest.fn(async (e: unknown) => e),
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Pago) {
            return mockPagoRepo;
          }
          if (entity === AuditoriaCartera) {
            return mockAuditoriaRepo;
          }
          if (entity === Cuota) {
            return mockCuotaRepo;
          }
          return {
            create: jest.fn((e: unknown) => e),
            save: jest.fn(async (e: unknown) => e),
            delete: jest.fn(async () => ({ affected: 1 })),
          };
        }),
      }),
    ),
  };

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

  function cuotaFixture(overrides: Partial<Cuota> = {}): Cuota {
    return {
      id: 10,
      prestamoId: 20,
      numeroCuota: 1,
      valorEsperado: 120,
      fechaVencimiento: "2026-08-12",
      estatus: "pendiente",
      ...overrides,
    } as Cuota;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuotaService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Pago), useValue: mockPagoRepo },
        { provide: ReautenticacionService, useValue: mockReautenticacion },
        { provide: getRepositoryToken(AuditoriaCartera), useValue: mockAuditoriaRepo },
        { provide: CajaService, useValue: mockCajaService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(CuotaService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    cuotaRepo = module.get(getRepositoryToken(Cuota));
    pagoRepo = module.get(getRepositoryToken(Pago));
    auditoriaRepo = module.get(getRepositoryToken(AuditoriaCartera));
  });

  it("lanza NotFoundException si la ruta no existe al editar", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.editarCuota(999, 10, { valorEsperado: 100 }, { password: "x", motivo: "m" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("lanza UnauthorizedException si la contraseña del operador no coincide", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuotaFixture());
    (mockReautenticacion.validar as jest.Mock).mockRejectedValue(new UnauthorizedException());

    await expect(
      service.editarCuota(1, 10, { valorEsperado: 100 }, { password: "mala", motivo: "m" }, adminContext),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("edita la cuota pendiente con auditoría y sin tocar caja", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    (mockReautenticacion.validar as jest.Mock).mockResolvedValue(undefined);
    (cuotaRepo.save as jest.Mock).mockImplementation(async (c: Cuota) => c);
    (auditoriaRepo.create as jest.Mock).mockImplementation((e: Partial<AuditoriaCartera>) => e as AuditoriaCartera);

    const result = await service.editarCuota(
      1,
      10,
      { valorEsperado: 100 },
      { password: "ok", motivo: "corrección" },
      adminContext,
    );

    expect(cuota.valorEsperado).toBe(100);
    expect(auditoriaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ entidad: "cuota", entidadId: 10, operacion: "editar", motivo: "corrección" }),
    );
    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
    expect(result.valorEsperado).toBe(100);
  });

  it("ajusta la caja por la diferencia al editar una cuota pagada", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const cuota = cuotaFixture({ estatus: "pagada" });
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    (mockReautenticacion.validar as jest.Mock).mockResolvedValue(undefined);
    (cuotaRepo.save as jest.Mock).mockImplementation(async (c: Cuota) => c);
    (auditoriaRepo.create as jest.Mock).mockImplementation((e: Partial<AuditoriaCartera>) => e as AuditoriaCartera);

    await service.editarCuota(
      1,
      10,
      { valorEsperado: 100 },
      { password: "ok", motivo: "baja" },
      adminContext,
    );

    // Antes 120, después 100 → la caja se reduce en 20.
    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
      1,
      -20,
      TipoMovimientoCaja.PAGO,
      adminContext,
      expect.any(String),
      expect.anything(),
    );
  });

  it("actualiza el valor del pago al editar una cuota pagada", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const cuota = cuotaFixture({ estatus: "pagada" });
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    (mockReautenticacion.validar as jest.Mock).mockResolvedValue(undefined);
    (cuotaRepo.save as jest.Mock).mockImplementation(async (c: Cuota) => c);
    const pago = { id: 30, cuotaId: 10, valor: 120 } as Pago;
    (pagoRepo.findOne as jest.Mock).mockResolvedValue(pago);
    (pagoRepo.save as jest.Mock).mockImplementation(async (p: Pago) => p);
    (auditoriaRepo.create as jest.Mock).mockImplementation((e: Partial<AuditoriaCartera>) => e as AuditoriaCartera);

    await service.editarCuota(
      1,
      10,
      { valorEsperado: 100 },
      { password: "ok", motivo: "baja" },
      adminContext,
    );

    expect(pago.valor).toBe(100);
    expect(mockPagoRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 30, valor: 100 }),
    );
  });

  it("lanza 400 si edita con motivo vacío", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuotaFixture());

    await expect(
      service.editarCuota(1, 10, { valorEsperado: 100 }, { password: "x", motivo: "" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("elimina la cuota pendiente con auditoría", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    (mockReautenticacion.validar as jest.Mock).mockResolvedValue(undefined);
    (auditoriaRepo.create as jest.Mock).mockImplementation((e: Partial<AuditoriaCartera>) => e as AuditoriaCartera);

    await service.eliminarCuota(
      1,
      10,
      { password: "ok", motivo: "error de captura" },
      adminContext,
    );

    expect(cuotaRepo.delete).toHaveBeenCalledWith({ id: 10 });
    expect(auditoriaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ entidad: "cuota", entidadId: 10, operacion: "eliminar" }),
    );
    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("revierte la caja y deja el pago con cuota_id nulo al eliminar una cuota pagada", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const cuota = cuotaFixture({ estatus: "pagada" });
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    (pagoRepo.findOne as jest.Mock).mockResolvedValue({ id: 30, cuotaId: 10 } as Pago);
    (mockReautenticacion.validar as jest.Mock).mockResolvedValue(undefined);
    (auditoriaRepo.create as jest.Mock).mockImplementation((e: Partial<AuditoriaCartera>) => e as AuditoriaCartera);

    await service.eliminarCuota(
      1,
      10,
      { password: "ok", motivo: "error" },
      adminContext,
    );

    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
      1,
      -120,
      TipoMovimientoCaja.PAGO,
      adminContext,
      expect.any(String),
      expect.anything(),
    );
    expect(mockPagoRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 30, cuotaId: null }),
    );
  });

  it("un socio no puede editar una cuota en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.editarCuota(1, 10, { valorEsperado: 100 }, { password: "x", motivo: "m" }, socioContext),
    ).rejects.toThrow(ForbiddenException);
  });
});
