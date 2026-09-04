import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { CajaService } from "../rutas/caja.service";
import { ReautenticacionService } from "../security/reautenticacion.service";
import { NotificacionesService } from "./notificaciones.service";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { Pago } from "./pago.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";
import { PagosService } from "./pagos.service";

describe("PagosService", () => {
  let service: PagosService;
  let rutaRepo: Repository<Ruta>;
  let cuotaRepo: Repository<Cuota>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockClienteRepo = { findOne: jest.fn() };
  const mockPagoRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
  const mockAuditoriaRepo = { create: jest.fn(), save: jest.fn() };
  const mockCajaService = { aplicarMovimiento: jest.fn() };
  const mockNotificacionesService = { enviarConfirmacionPago: jest.fn() };
  const mockReautenticacion = { validar: jest.fn() };
  let repoAuditoriaTx: { create: jest.Mock; save: jest.Mock };
  let repoPagoTx: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
      repoPagoTx = {
        create: jest.fn((e: unknown) => e),
        save: jest.fn(async (e: unknown) => e),
        delete: jest.fn(),
      };
      repoAuditoriaTx = { create: jest.fn((e: unknown) => e), save: jest.fn(async (e: unknown) => e) };
      const m = {
        save: jest.fn(async (e: unknown) => e),
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Pago) return repoPagoTx;
          return repoAuditoriaTx;
        }),
      };
      return fn(m);
    }),
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
      prestamo: {
        id: 20,
        rutaId: 1,
        cliente: { id: 5, rutaId: 1 },
      } as unknown as Prestamo,
      ...overrides,
    } as Cuota;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(Prestamo), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Pago), useValue: mockPagoRepo },
        { provide: getRepositoryToken(AuditoriaCartera), useValue: mockAuditoriaRepo },
        { provide: CajaService, useValue: mockCajaService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NotificacionesService, useValue: mockNotificacionesService },
        { provide: ReautenticacionService, useValue: mockReautenticacion },
      ],
    }).compile();

    service = module.get(PagosService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    cuotaRepo = module.get(getRepositoryToken(Cuota));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrarPagoDeCuota(999, { cuotaId: 10, valor: 120, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede pagar en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.registrarPagoDeCuota(1, { cuotaId: 10, valor: 120, metodoPago: "efectivo" }, socioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si la cuota no existe o no pertenece a la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrarPagoDeCuota(1, { cuotaId: 10, valor: 120, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("rechaza con 400 si la cuota ya está pagada", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuotaFixture({ estatus: "pagada" }));

    await expect(
      service.registrarPagoDeCuota(1, { cuotaId: 10, valor: 120, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza con 400 si el valor no coincide con valorEsperado", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuotaFixture());

    await expect(
      service.registrarPagoDeCuota(1, { cuotaId: 10, valor: 100, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("marca la cuota pagada, persiste el pago y aplica la caja en la misma transacción", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    (cuotaRepo.save as jest.Mock).mockImplementation(async (c: Cuota) => c);

    const result = await service.registrarPagoDeCuota(
      1,
      { cuotaId: 10, valor: 120, metodoPago: "efectivo" },
      adminContext,
    );

    expect(cuota.estatus).toBe("pagada");
    expect(result).toMatchObject({ cuotaId: 10, valor: 120, metodoPago: "efectivo" });
    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
      1,
      120,
      "pago",
      adminContext,
      "cuota 1 (prestamo 20)",
      expect.anything(),
    );
    expect(mockNotificacionesService.enviarConfirmacionPago).toHaveBeenCalled();
  });

  it("no rompe el registro del pago si falla la confirmación", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    (cuotaRepo.save as jest.Mock).mockImplementation(async (c: Cuota) => c);
    (mockNotificacionesService.enviarConfirmacionPago as jest.Mock).mockRejectedValue(new Error("gateway"));

    const result = await service.registrarPagoDeCuota(
      1,
      { cuotaId: 10, valor: 120, metodoPago: "efectivo" },
      adminContext,
    );

    expect(cuota.estatus).toBe("pagada");
    expect(result.cuotaId).toBe(10);
  });

  it("registra el pago con visitaId y manager externo cuando se componen (no abre transacción propia)", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);

    const managerExterno = {
      getRepository: jest.fn(() => ({
        create: jest.fn((e: unknown) => e),
        save: jest.fn(async (e: unknown) => e),
      })),
    };

    const result = await service.registrarPagoDeCuota(
      1,
      { cuotaId: 10, valor: 120, metodoPago: "qr" },
      adminContext,
      { manager: managerExterno as never, visitaId: 99 },
    );

    expect(result).toMatchObject({ cuotaId: 10, valor: 120, metodoPago: "qr" });
    // No debe abrir transacción propia cuando se compone con manager externo.
    expect(mockDataSource.transaction).not.toHaveBeenCalled();
    expect(managerExterno.getRepository).toHaveBeenCalled();
  });

  describe("eliminarPago", () => {
    const pagoFixture = (overrides: Partial<Pago> = {}): Pago =>
      ({
        id: 30,
        cuotaId: 10,
        clienteId: 5,
        visitaId: null,
        valor: 120,
        metodoPago: "efectivo",
        fechaHora: new Date("2026-09-04T12:00:00Z"),
        registradoPor: 1,
        liquidado: false,
        fechaLiquidacion: null,
        cuota: { id: 10 },
        ...overrides,
      }) as Pago;

    it("lanza NotFoundException si la ruta no existe", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.eliminarPago(999, 30, { password: "x", motivo: "error" }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("exige el motivo", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());

      await expect(
        service.eliminarPago(1, 30, { password: "x", motivo: "  " }, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it("lanza NotFound si el pago no existe en la ruta", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (mockPagoRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.eliminarPago(1, 30, { password: "x", motivo: "error" }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("rechaza borrar un pago ya liquidado", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (mockPagoRepo.findOne as jest.Mock).mockResolvedValue(pagoFixture({ liquidado: true }));

      await expect(
        service.eliminarPago(1, 30, { password: "x", motivo: "error" }, adminContext),
      ).rejects.toThrow("ya liquidado");
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it("elimina el pago, revierte la caja y audita en la transacción", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (mockPagoRepo.findOne as jest.Mock).mockResolvedValue(pagoFixture());

      const result = await service.eliminarPago(
        1,
        30,
        { password: "secreto", motivo: "registro erróneo" },
        adminContext,
      );

      expect(mockReautenticacion.validar).toHaveBeenCalledWith(adminContext, "secreto");
      expect(result).toEqual({ id: 30 });
      expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
        1,
        -120,
        expect.anything(),
        adminContext,
        expect.stringContaining("eliminación de pago 30"),
        expect.anything(),
      );
      expect(repoPagoTx.delete).toHaveBeenCalledWith({ id: 30 });
      expect(repoAuditoriaTx.create).toHaveBeenCalledWith(
        expect.objectContaining({ entidad: "pago", entidadId: 30, operacion: "eliminar" }),
      );
      expect(repoAuditoriaTx.save).toHaveBeenCalled();
    });
  });
});
