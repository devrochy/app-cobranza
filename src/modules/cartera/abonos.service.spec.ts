import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { CajaService, TipoMovimientoCaja } from "../rutas/caja.service";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { Abono } from "./abono.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";
import { AbonosService } from "./abonos.service";
import { ReautenticacionService } from "../security/reautenticacion.service";

describe("AbonosService", () => {
  let service: AbonosService;
  let rutaRepo: Repository<Ruta>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let abonoRepo: Repository<Abono>;
  let auditoriaRepo: Repository<AuditoriaCartera>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockPrestamoRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { find: jest.fn() };
  const mockAbonoRepo = { find: jest.fn(), findOne: jest.fn(), delete: jest.fn(), create: jest.fn((e: unknown) => e), save: jest.fn(async (e: unknown) => e) };
  const mockClienteRepo = { findOne: jest.fn() };
  const mockCajaService = { aplicarMovimiento: jest.fn() };
  const mockAuditoriaRepo = { create: jest.fn(), save: jest.fn() };
  const mockReautenticacion = { validar: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        save: jest.fn(async (e: unknown) => e),
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Abono) {
            return mockAbonoRepo;
          }
          if (entity === AuditoriaCartera) {
            return mockAuditoriaRepo;
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbonosService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Prestamo), useValue: mockPrestamoRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Abono), useValue: mockAbonoRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: CajaService, useValue: mockCajaService },
        { provide: getRepositoryToken(AuditoriaCartera), useValue: mockAuditoriaRepo },
        { provide: ReautenticacionService, useValue: mockReautenticacion },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(AbonosService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    prestamoRepo = module.get(getRepositoryToken(Prestamo));
    cuotaRepo = module.get(getRepositoryToken(Cuota));
    abonoRepo = module.get(getRepositoryToken(Abono));
    auditoriaRepo = module.get(getRepositoryToken(AuditoriaCartera));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrarAbono(999, { prestamoId: 20, valor: 50, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede abonar en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.registrarAbono(1, { prestamoId: 20, valor: 50, metodoPago: "efectivo" }, socioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si el préstamo no existe o no pertenece a la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrarAbono(1, { prestamoId: 20, valor: 50, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("lanza NotFoundException si el préstamo no está vigente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "liquidado" } as Prestamo);

    await expect(
      service.registrarAbono(1, { prestamoId: 20, valor: 50, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("rechaza con 400 si el abono excede la deuda pendiente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente", cliente: { id: 5 } } as Prestamo);
    // Deuda pendiente = 100 (una cuota pendiente)
    (cuotaRepo.find as jest.Mock).mockResolvedValue([{ valorEsperado: 100 }]);
    (abonoRepo.find as jest.Mock).mockResolvedValue([{ valor: 40 }]);

    await expect(
      service.registrarAbono(1, { prestamoId: 20, valor: 80, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("registra el abono y aplica la caja en la misma transacción", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente", cliente: { id: 5 } } as Prestamo);
    (cuotaRepo.find as jest.Mock).mockResolvedValue([{ valorEsperado: 100 }]);
    (abonoRepo.find as jest.Mock).mockResolvedValue([{ valor: 40 }]);

    const result = await service.registrarAbono(
      1,
      { prestamoId: 20, valor: 30, metodoPago: "transferencia" },
      adminContext,
    );

    expect(result).toMatchObject({ prestamoId: 20, valor: 30, metodoPago: "transferencia" });
    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
      1,
      30,
      "abono",
      adminContext,
      "abono prestamo 20",
      expect.anything(),
    );
  });

  it("registra el abono con visitaId y manager externo cuando se componen (no abre transacción propia)", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente", cliente: { id: 5 } } as Prestamo);
    (cuotaRepo.find as jest.Mock).mockResolvedValue([{ valorEsperado: 100 }]);
    (abonoRepo.find as jest.Mock).mockResolvedValue([{ valor: 40 }]);

    const managerExterno = {
      getRepository: jest.fn(() => ({
        create: jest.fn((e: unknown) => e),
        save: jest.fn(async (e: unknown) => e),
      })),
    };

    const result = await service.registrarAbono(
      1,
      { prestamoId: 20, valor: 30, metodoPago: "qr" },
      adminContext,
      { manager: managerExterno as never, visitaId: 99 },
    );

    expect(result).toMatchObject({ prestamoId: 20, valor: 30, metodoPago: "qr" });
    expect(mockDataSource.transaction).not.toHaveBeenCalled();
    expect(managerExterno.getRepository).toHaveBeenCalled();
  });

  it("lanza UnauthorizedException al eliminar abono si la contraseña no coincide", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockReautenticacion.validar as jest.Mock).mockRejectedValue(new UnauthorizedException());

    await expect(
      service.eliminarAbono(1, 10, { password: "mala", motivo: "m" }, adminContext),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("elimina el abono, revierte la caja y registra auditoría", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockReautenticacion.validar as jest.Mock).mockResolvedValue(undefined);
    (abonoRepo.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      prestamoId: 20,
      clienteId: 5,
      visitaId: null,
      valor: 30,
      metodoPago: "qr",
      fechaHora: new Date(),
      registradoPor: 1,
    } as Abono);
    (abonoRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
    (auditoriaRepo.create as jest.Mock).mockImplementation((e: Partial<AuditoriaCartera>) => e as AuditoriaCartera);

    const result = await service.eliminarAbono(
      1,
      10,
      { password: "ok", motivo: "error de captura" },
      adminContext,
    );

    expect(abonoRepo.delete).toHaveBeenCalledWith({ id: 10 });
    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
      1,
      -30,
      TipoMovimientoCaja.ABONO,
      adminContext,
      expect.any(String),
      expect.anything(),
    );
    expect(auditoriaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ entidad: "abono", entidadId: 10, operacion: "eliminar" }),
    );
    expect(result.id).toBe(10);
  });

  it("lanza 400 al eliminar abono sin motivo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (abonoRepo.findOne as jest.Mock).mockResolvedValue({ id: 10 } as Abono);

    await expect(
      service.eliminarAbono(1, 10, { password: "x", motivo: "" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("lanza NotFoundException si el abono no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockReautenticacion.validar as jest.Mock).mockResolvedValue(undefined);
    (abonoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.eliminarAbono(1, 999, { password: "ok", motivo: "m" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });
});
