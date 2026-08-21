import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Prestamo } from "./prestamo.entity";
import { PromesaPago } from "./promesa-pago.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";
import { PromesasPagoService } from "./promesas-pago.service";

describe("PromesasPagoService", () => {
  let service: PromesasPagoService;

  const mockRutaRepo = { findOne: jest.fn() };
  const mockPrestamoRepo = { findOne: jest.fn() };
  const mockPromesaRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
  const mockAuditoriaRepo = { create: jest.fn(), save: jest.fn() };
  const mockDataSource = { transaction: jest.fn() };

  const adminContext = { rol: "admin" as const, sub: 1 };
  const socioContext = { rol: "socio" as const, sub: 2 };

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

  function promesaFixture(overrides: Partial<PromesaPago> = {}): PromesaPago {
    return {
      id: 30,
      prestamoId: 5,
      visitaId: null,
      conversacionId: 7,
      fechaPrometida: "2026-09-01",
      valorPrometido: 100,
      estado: "pendiente",
      creadoPor: "ia",
      tipo: "promesa",
      createdAt: new Date(),
      ...overrides,
    } as PromesaPago;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const mockManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PromesaPago) return mockPromesaRepo;
        if (entity === AuditoriaCartera) return mockAuditoriaRepo;
        return {};
      }),
    };
    mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => Promise<unknown>) =>
      cb(mockManager),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromesasPagoService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Prestamo), useValue: mockPrestamoRepo },
        { provide: getRepositoryToken(PromesaPago), useValue: mockPromesaRepo },
        { provide: getRepositoryToken(AuditoriaCartera), useValue: mockAuditoriaRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(PromesasPagoService);
  });

  describe("listarPorPrestamo", () => {
    it("lanza NotFound si la ruta no existe", async () => {
      mockRutaRepo.findOne.mockResolvedValue(null);
      await expect(service.listarPorPrestamo(999, 5, adminContext)).rejects.toThrow(NotFoundException);
    });

    it("un socio no puede ver promesas de una ruta ajena", async () => {
      mockRutaRepo.findOne.mockResolvedValue(rutaFixture({ socioId: 5 }));
      await expect(service.listarPorPrestamo(1, 5, socioContext)).rejects.toThrow(ForbiddenException);
    });

    it("lanza NotFound si el préstamo no existe en la ruta", async () => {
      mockRutaRepo.findOne.mockResolvedValue(rutaFixture());
      mockPrestamoRepo.findOne.mockResolvedValue(null);
      await expect(service.listarPorPrestamo(1, 999, adminContext)).rejects.toThrow(NotFoundException);
    });

    it("devuelve el historial de promesas del préstamo con su origen", async () => {
      mockRutaRepo.findOne.mockResolvedValue(rutaFixture());
      mockPrestamoRepo.findOne.mockResolvedValue({ id: 5 } as Prestamo);
      mockPromesaRepo.find.mockResolvedValue([
        promesaFixture({ id: 30, estado: "pendiente", creadoPor: "ia", conversacionId: 7, visitaId: null }),
        promesaFixture({ id: 31, estado: "cumplida", creadoPor: "cobrador", conversacionId: null, visitaId: 12 }),
      ]);

      const res = await service.listarPorPrestamo(1, 5, adminContext);

      expect(res).toHaveLength(2);
      expect(res[0]).toMatchObject({ id: 30, estado: "pendiente", origenConversacionId: 7, origenVisitaId: null });
      expect(res[1]).toMatchObject({ id: 31, origenConversacionId: null, origenVisitaId: 12 });
    });
  });

  describe("transicionarEstado", () => {
    it("lanza NotFound si la ruta no existe", async () => {
      mockRutaRepo.findOne.mockResolvedValue(null);
      await expect(
        service.transicionarEstado(999, 30, { estado: "cumplida", motivo: "pagó" }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("lanza NotFound si la promesa no existe en la ruta", async () => {
      mockRutaRepo.findOne.mockResolvedValue(rutaFixture());
      mockPromesaRepo.findOne.mockResolvedValue(null);
      await expect(
        service.transicionarEstado(1, 999, { estado: "cumplida", motivo: "pagó" }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("rechaza transicionar al mismo estado", async () => {
      mockRutaRepo.findOne.mockResolvedValue(rutaFixture());
      mockPromesaRepo.findOne.mockResolvedValue(promesaFixture({ estado: "cumplida" }));
      await expect(
        service.transicionarEstado(1, 30, { estado: "cumplida", motivo: "pagó" }, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it("rechaza transicionar con motivo de solo espacios", async () => {
      mockRutaRepo.findOne.mockResolvedValue(rutaFixture());
      mockPromesaRepo.findOne.mockResolvedValue(promesaFixture({ estado: "pendiente" }));
      await expect(
        service.transicionarEstado(1, 30, { estado: "cumplida", motivo: "   " }, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it("transiciona el estado y registra la auditoría imborrable", async () => {
      mockRutaRepo.findOne.mockResolvedValue(rutaFixture());
      mockPromesaRepo.findOne.mockResolvedValue(promesaFixture({ estado: "pendiente" }));
      mockPromesaRepo.save.mockImplementation((p: PromesaPago) => Promise.resolve(p));
      mockAuditoriaRepo.create.mockImplementation((e: Partial<AuditoriaCartera>) => e as AuditoriaCartera);
      mockAuditoriaRepo.save.mockResolvedValue({ id: 1 });

      const res = await service.transicionarEstado(
        1,
        30,
        { estado: "cumplida", motivo: "el cliente pagó" },
        adminContext,
      );

      expect(res.estado).toBe("cumplida");
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockAuditoriaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entidad: "promesa",
          entidadId: 30,
          operacion: "editar",
          actorRol: "admin",
          actorId: 1,
          motivo: "el cliente pagó",
        }),
      );
      expect(mockAuditoriaRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});