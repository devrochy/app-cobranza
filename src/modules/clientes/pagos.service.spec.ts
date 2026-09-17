import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { CajaService } from "../carteras/caja.service";
import { ReautenticacionService } from "../security/reautenticacion.service";
import { NotificacionesService } from "./notificaciones.service";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { Pago } from "./pago.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";
import { PagosService } from "./pagos.service";
import { ColorRiesgoService } from "./color-riesgo.service";

describe("PagosService", () => {
  let service: PagosService;
  let carteraRepo: Repository<Cartera>;
  let cuotaRepo: Repository<Cuota>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { findOne: jest.fn(), save: jest.fn(), update: jest.fn() };
  const mockClienteRepo = { findOne: jest.fn() };
  const mockPagoRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
  const mockAuditoriaRepo = { create: jest.fn(), save: jest.fn() };
  const mockCajaService = { aplicarMovimiento: jest.fn() };
  const mockNotificacionesService = { enviarConfirmacionPago: jest.fn() };
  const mockReautenticacion = { validar: jest.fn() };
  const mockColorRiesgo = { recalcularSeguro: jest.fn() };
  let repoAuditoriaTx: { create: jest.Mock; save: jest.Mock };
  let repoPagoTx: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let repoCuotaTx: { update: jest.Mock };
  let cuotaUpdateResult: { affected: number };
  let pagoDeleteResult: { affected: number };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
      repoPagoTx = {
        create: jest.fn((e: unknown) => e),
        save: jest.fn(async (e: unknown) => e),
        delete: jest.fn(async () => pagoDeleteResult),
      };
      repoAuditoriaTx = { create: jest.fn((e: unknown) => e), save: jest.fn(async (e: unknown) => e) };
      repoCuotaTx = { update: jest.fn(async () => cuotaUpdateResult) };
      const m = {
        save: jest.fn(async (e: unknown) => e),
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Pago) return repoPagoTx;
          if (entity === Cuota) return repoCuotaTx;
          return repoAuditoriaTx;
        }),
      };
      return fn(m);
    }),
  };

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
        carteraId: 1,
        cliente: { id: 5, carteraId: 1 },
      } as unknown as Prestamo,
      ...overrides,
    } as Cuota;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    cuotaUpdateResult = { affected: 1 };
    pagoDeleteResult = { affected: 1 };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(Prestamo), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Pago), useValue: mockPagoRepo },
        { provide: getRepositoryToken(AuditoriaCartera), useValue: mockAuditoriaRepo },
        { provide: CajaService, useValue: mockCajaService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NotificacionesService, useValue: mockNotificacionesService },
        { provide: ReautenticacionService, useValue: mockReautenticacion },
        { provide: ColorRiesgoService, useValue: mockColorRiesgo },
      ],
    }).compile();

    service = module.get(PagosService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    cuotaRepo = module.get(getRepositoryToken(Cuota));
  });

  it("lanza NotFoundException si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrarPagoDeCuota(999, { cuotaId: 10, valor: 120, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede pagar en una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(
      service.registrarPagoDeCuota(1, { cuotaId: 10, valor: 120, metodoPago: "efectivo" }, propietarioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si la cuota no existe o no pertenece a la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrarPagoDeCuota(1, { cuotaId: 10, valor: 120, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("rechaza con 400 si la cuota ya está pagada", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuotaFixture({ estatus: "pagada" }));

    await expect(
      service.registrarPagoDeCuota(1, { cuotaId: 10, valor: 120, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza con 400 si el valor no coincide con valorEsperado", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuotaFixture());

    await expect(
      service.registrarPagoDeCuota(1, { cuotaId: 10, valor: 100, metodoPago: "efectivo" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("marca la cuota pagada (UPDATE condicional), persiste el pago y aplica la caja en la misma transacción", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);

    const result = await service.registrarPagoDeCuota(
      1,
      { cuotaId: 10, valor: 120, metodoPago: "efectivo" },
      adminContext,
    );

    expect(repoCuotaTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10 }),
      { estatus: "pagada" },
    );
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

  it("rechaza con 400 si la cuota fue pagada concurrentemente (affected=0)", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    cuotaUpdateResult = { affected: 0 };

    await expect(
      service.registrarPagoDeCuota(
        1,
        { cuotaId: 10, valor: 120, metodoPago: "efectivo" },
        adminContext,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("no rompe el registro del pago si falla la confirmación", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);
    (mockNotificacionesService.enviarConfirmacionPago as jest.Mock).mockRejectedValue(new Error("gateway"));

    const result = await service.registrarPagoDeCuota(
      1,
      { cuotaId: 10, valor: 120, metodoPago: "efectivo" },
      adminContext,
    );

    expect(result.cuotaId).toBe(10);
  });

  it("registra el pago con visitaId y manager externo cuando se componen (no abre transacción propia)", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const cuota = cuotaFixture();
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuota);

    const managerExterno = {
      getRepository: jest.fn(() => ({
        create: jest.fn((e: unknown) => e),
        save: jest.fn(async (e: unknown) => e),
        update: jest.fn(async () => ({ affected: 1 })),
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

    it("lanza NotFoundException si la cartera no existe", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.eliminarPago(999, 30, { password: "x", motivo: "error" }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("exige el motivo", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());

      await expect(
        service.eliminarPago(1, 30, { password: "x", motivo: "  " }, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it("lanza NotFound si el pago no existe en la cartera", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (mockPagoRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.eliminarPago(1, 30, { password: "x", motivo: "error" }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("rechaza borrar un pago ya liquidado", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (mockPagoRepo.findOne as jest.Mock).mockResolvedValue(pagoFixture({ liquidado: true }));

      await expect(
        service.eliminarPago(1, 30, { password: "x", motivo: "error" }, adminContext),
      ).rejects.toThrow("ya liquidado");
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it("elimina el pago, revierte la caja y audita en la transacción", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
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
      expect(mockColorRiesgo.recalcularSeguro).toHaveBeenCalledWith(5, 1, expect.anything());
      expect(repoPagoTx.delete).toHaveBeenCalledWith({ id: 30 });
      expect(repoAuditoriaTx.create).toHaveBeenCalledWith(
        expect.objectContaining({ entidad: "pago", entidadId: 30, operacion: "eliminar" }),
      );
      expect(repoAuditoriaTx.save).toHaveBeenCalled();
    });

    it("reabre la cuota asociada al eliminar el pago", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (mockPagoRepo.findOne as jest.Mock).mockResolvedValue(pagoFixture());

      await service.eliminarPago(
        1,
        30,
        { password: "secreto", motivo: "registro erróneo" },
        adminContext,
      );

      expect(repoCuotaTx.update).toHaveBeenCalledWith(
        { id: 10, estatus: "pagada" },
        { estatus: "pendiente" },
      );
    });

    it("no revierte la caja si el pago ya fue eliminado concurrentemente", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (mockPagoRepo.findOne as jest.Mock).mockResolvedValue(pagoFixture());
      pagoDeleteResult = { affected: 0 };

      const result = await service.eliminarPago(
        1,
        30,
        { password: "secreto", motivo: "registro erróneo" },
        adminContext,
      );

      expect(result).toEqual({ id: 30 });
      expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
    });
  });
});
