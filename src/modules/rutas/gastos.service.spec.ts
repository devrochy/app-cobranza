import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { Gasto } from "./gasto.entity";
import { GastoEvidencia } from "./gasto-evidencia.entity";
import { GastosService } from "./gastos.service";
import { CajaService } from "./caja.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";

describe("GastosService", () => {
  let service: GastosService;
  let rutaRepo: Repository<Ruta>;
  let gastoRepo: Repository<Gasto>;
  let evidenciaRepo: Repository<GastoEvidencia>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockGastoRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() };
  const mockEvidenciaRepo = { create: jest.fn(), save: jest.fn() };
  const mockCajaService = { aplicarMovimiento: jest.fn() };
  const mockPermisosSocio = { tienePermiso: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        save: jest.fn(async (e: { id?: number } & object) => {
          if (e && typeof e === "object" && !("id" in e)) {
            return { ...e, id: 123 };
          }
          return e;
        }),
        getRepository: jest.fn((entity: unknown) => {
          if (entity === GastoEvidencia) {
            return mockEvidenciaRepo;
          }
          if (entity === Gasto) {
            return mockGastoRepo;
          }
          const repo = {
            create: jest.fn((e: unknown) => e),
            save: jest.fn(async (e: { id?: number } & object) => {
              if (e && typeof e === "object" && !("id" in e)) {
                return { ...e, id: 123 };
              }
              return e;
            }),
          };
          return repo;
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

  function gastoFixture(overrides: Partial<Gasto> = {}): Gasto {
    return {
      id: 1,
      rutaId: 1,
      descripcion: "Combustible",
      valor: 50,
      creadoPor: 5,
      aprobado: false,
      aprobadoPor: null,
      estado: "activo",
      fechaHora: new Date(),
      ...overrides,
    } as Gasto;
  }

  interface ArchivoSubido {
    originalname: string;
    mimetype: string;
    size: number;
    filename: string;
    path: string;
  }

  function archivoFixture(overrides: Partial<ArchivoSubido> = {}): ArchivoSubido {
    return {
      originalname: "factura.pdf",
      mimetype: "application/pdf",
      size: 1024,
      filename: "abc.pdf",
      path: "/uploads/abc.pdf",
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockGastoRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GastosService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Gasto), useValue: mockGastoRepo },
        { provide: getRepositoryToken(GastoEvidencia), useValue: mockEvidenciaRepo },
        { provide: CajaService, useValue: mockCajaService },
        { provide: PermisosSocioService, useValue: mockPermisosSocio },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(GastosService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    gastoRepo = module.get(getRepositoryToken(Gasto));
    evidenciaRepo = module.get(getRepositoryToken(GastoEvidencia));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrar(999, { descripcion: "X", valor: 10 }, [], adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede registrar un gasto en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.registrar(1, { descripcion: "X", valor: 10 }, [], socioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("registra el gasto pendiente con sus evidencias", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (gastoRepo.create as jest.Mock).mockImplementation((e: Partial<Gasto>) => e as Gasto);
    (gastoRepo.save as jest.Mock).mockImplementation(async (e: Partial<Gasto>) => ({
      id: 1,
      ...e,
    }) as Gasto);
    (evidenciaRepo.create as jest.Mock).mockImplementation((e: Partial<GastoEvidencia>) => e as GastoEvidencia);

    const result = await service.registrar(
      1,
      { descripcion: "Combustible", valor: 50 },
      [archivoFixture()],
      adminContext,
    );

    expect(result.aprobado).toBe(false);
    expect(result.descripcion).toBe("Combustible");
    expect(evidenciaRepo.save).toHaveBeenCalled();
  });

  it("no descuenta caja al registrar (pendiente de aprobación)", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (gastoRepo.create as jest.Mock).mockImplementation((e: Partial<Gasto>) => e as Gasto);
    (gastoRepo.save as jest.Mock).mockImplementation(async (e: Partial<Gasto>) => ({
      id: 1,
      ...e,
    }) as Gasto);

    await service.registrar(1, { descripcion: "X", valor: 10 }, [], adminContext);

    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("aprueba el gasto y descuenta la caja (Admin)", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const gasto = gastoFixture();
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);
    (gastoRepo.save as jest.Mock).mockImplementation(async (g: Gasto) => g);

    await service.aprobar(1, 1, adminContext);

    expect(gasto.aprobado).toBe(true);
    expect(gasto.aprobadoPor).toBe(0);
    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
      1,
      -50,
      "gasto",
      adminContext,
      "Combustible",
      expect.anything(),
    );
  });

  it("un socio sin generar_reporte no puede aprobar -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());

    await expect(service.aprobar(1, 1, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("un socio con generar_reporte puede aprobar su propio gasto", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(true);
    const gasto = gastoFixture();
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);
    (gastoRepo.save as jest.Mock).mockImplementation(async (g: Gasto) => g);

    await service.aprobar(1, 1, socioContext);

    expect(gasto.aprobado).toBe(true);
    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalled();
  });

  it("lanza NotFoundException al aprobar si el gasto no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.aprobar(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("lanza ForbiddenException si el UPDATE condicional no afecta filas (concurrencia)", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const gasto = gastoFixture();
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);
    (mockGastoRepo.update as jest.Mock).mockResolvedValue({ affected: 0 });

    await expect(service.aprobar(1, 1, adminContext)).rejects.toThrow(ForbiddenException);
    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("lanza NotFoundException al eliminar si el gasto no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.eliminar(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede eliminar un gasto en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.eliminar(1, 1, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("no descuenta caja dos veces si el gasto ya estaba aprobado", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const gasto = gastoFixture({ aprobado: true, aprobadoPor: 1 });
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);

    await service.aprobar(1, 1, adminContext);

    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("elimina (soft-delete) y revierte la caja si estaba aprobado", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const gasto = gastoFixture({ aprobado: true, aprobadoPor: 1 });
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);
    (gastoRepo.save as jest.Mock).mockImplementation(async (g: Gasto) => g);

    await service.eliminar(1, 1, adminContext);

    expect(gasto.estado).toBe("eliminado");
    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalledWith(
      1,
      50,
      "gasto_eliminado",
      adminContext,
      "Combustible",
      expect.anything(),
    );
  });

  it("no revierte caja si el gasto no estaba aprobado", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    const gasto = gastoFixture();
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);

    await service.eliminar(1, 1, adminContext);

    expect(gasto.estado).toBe("eliminado");
    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });
});
