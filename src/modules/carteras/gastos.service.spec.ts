import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cartera } from "./cartera.entity";
import { Gasto } from "./gasto.entity";
import { GastoEvidencia } from "./gasto-evidencia.entity";
import { GastosService } from "./gastos.service";
import { CajaService } from "./caja.service";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { eliminarArchivosSubidos } from "../../common/archivos";

jest.mock("../../common/archivos", () => ({
  eliminarArchivosSubidos: jest.fn(),
}));

describe("GastosService", () => {
  let service: GastosService;
  let carteraRepo: Repository<Cartera>;
  let gastoRepo: Repository<Gasto>;
  let evidenciaRepo: Repository<GastoEvidencia>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockGastoRepo = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() };
  const mockEvidenciaRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockCajaService = { aplicarMovimiento: jest.fn() };
  const mockPermisosPropietario = { tienePermiso: jest.fn() };
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

  function gastoFixture(overrides: Partial<Gasto> = {}): Gasto {
    return {
      id: 1,
      carteraId: 1,
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
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(Gasto), useValue: mockGastoRepo },
        { provide: getRepositoryToken(GastoEvidencia), useValue: mockEvidenciaRepo },
        { provide: CajaService, useValue: mockCajaService },
        { provide: PermisosPropietarioService, useValue: mockPermisosPropietario },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(GastosService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    gastoRepo = module.get(getRepositoryToken(Gasto));
    evidenciaRepo = module.get(getRepositoryToken(GastoEvidencia));
  });

  it("lanza NotFoundException si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrar(999, { descripcion: "X", valor: 10 }, [], adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede registrar un gasto en una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(
      service.registrar(1, { descripcion: "X", valor: 10 }, [], propietarioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("registra el gasto pendiente con sus evidencias", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
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

  it("limpia las evidencias en disco si el registro falla", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    mockDataSource.transaction.mockRejectedValueOnce(new Error("boom"));

    await expect(
      service.registrar(
        1,
        { descripcion: "X", valor: 10 },
        [{ path: "/tmp/a.jpg", originalname: "a.jpg", mimetype: "image/jpeg", size: 1, filename: "a.jpg" }],
        adminContext,
      ),
    ).rejects.toThrow("boom");

    expect(eliminarArchivosSubidos).toHaveBeenCalledWith(["/tmp/a.jpg"]);
  });

  it("no descuenta caja al registrar (pendiente de aprobación)", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.create as jest.Mock).mockImplementation((e: Partial<Gasto>) => e as Gasto);
    (gastoRepo.save as jest.Mock).mockImplementation(async (e: Partial<Gasto>) => ({
      id: 1,
      ...e,
    }) as Gasto);

    await service.registrar(1, { descripcion: "X", valor: 10 }, [], adminContext);

    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("aprueba el gasto y descuenta la caja (Admin)", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
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

  it("un propietario sin generar_reporte no puede aprobar -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());

    await expect(service.aprobar(1, 1, propietarioContext)).rejects.toThrow(ForbiddenException);
  });

  it("un propietario con generar_reporte puede aprobar su propio gasto", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (mockPermisosPropietario.tienePermiso as jest.Mock).mockResolvedValue(true);
    const gasto = gastoFixture();
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);
    (gastoRepo.save as jest.Mock).mockImplementation(async (g: Gasto) => g);

    await service.aprobar(1, 1, propietarioContext);

    expect(gasto.aprobado).toBe(true);
    expect(mockCajaService.aplicarMovimiento).toHaveBeenCalled();
  });

  it("lanza NotFoundException al aprobar si el gasto no existe en la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.aprobar(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("lanza ForbiddenException si el UPDATE condicional no afecta filas (concurrencia)", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const gasto = gastoFixture();
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);
    (mockGastoRepo.update as jest.Mock).mockResolvedValue({ affected: 0 });

    await expect(service.aprobar(1, 1, adminContext)).rejects.toThrow(ForbiddenException);
    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("lanza NotFoundException al eliminar si el gasto no existe en la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.eliminar(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede eliminar un gasto en una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(service.eliminar(1, 1, propietarioContext)).rejects.toThrow(ForbiddenException);
  });

  it("no descuenta caja dos veces si el gasto ya estaba aprobado", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const gasto = gastoFixture({ aprobado: true, aprobadoPor: 1 });
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);

    await service.aprobar(1, 1, adminContext);

    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("elimina (soft-delete) y revierte la caja si estaba aprobado", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
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
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const gasto = gastoFixture();
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gasto);

    await service.eliminar(1, 1, adminContext);

    expect(gasto.estado).toBe("eliminado");
    expect(mockCajaService.aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("lista solo los gastos activos DESC con sus evidencias", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    const gastoActivo = gastoFixture();
    (gastoRepo.find as jest.Mock).mockResolvedValue([gastoActivo]);
    (evidenciaRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 1,
        gastoId: 1,
        nombreOriginal: "factura.pdf",
        mimetype: "application/pdf",
        tamaño: 1024,
        carteraArchivo: "/uploads/gastos/abc.pdf",
      },
    ]);

    const result = await service.listar(1, adminContext);

    expect(gastoRepo.find).toHaveBeenCalledWith({
      where: { cartera: { id: 1 }, estado: "activo" },
      order: { fechaHora: "DESC" },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].evidencias).toHaveLength(1);
    expect(result[0].evidencias[0].nombreOriginal).toBe("factura.pdf");
  });

  it("lanza NotFoundException al listar si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.listar(999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("devuelve evidencias vacías si el gasto no tiene", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.find as jest.Mock).mockResolvedValue([gastoFixture()]);
    (evidenciaRepo.find as jest.Mock).mockResolvedValue([]);

    const result = await service.listar(1, adminContext);

    expect(result[0].evidencias).toEqual([]);
  });

  it("no consulta evidencias si la lista de gastos está vacía", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.find as jest.Mock).mockResolvedValue([]);

    const result = await service.listar(1, adminContext);

    expect(result).toEqual([]);
    expect(evidenciaRepo.find).not.toHaveBeenCalled();
  });

  it("un propietario no puede listar gastos de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(service.listar(1, propietarioContext)).rejects.toThrow(ForbiddenException);
  });

  it("normaliza carteraArchivo a URL servible al listar evidencias", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.find as jest.Mock).mockResolvedValue([gastoFixture()]);
    (evidenciaRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 1,
        gastoId: 1,
        nombreOriginal: "factura.pdf",
        mimetype: "application/pdf",
        tamaño: 1024,
        carteraArchivo: "/Users/x/apps/uploads/gastos/abc.pdf",
      },
    ]);

    const result = await service.listar(1, adminContext);

    expect(result[0].evidencias[0].carteraArchivo).toBe("/uploads/gastos/abc.pdf");
  });

  it("descargarEvidencia lanza NotFound si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.descargarEvidencia(999, 1, 7, adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("descargarEvidencia devuelve los datos del archivo de la evidencia", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gastoFixture());
    (evidenciaRepo.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      gastoId: 1,
      nombreOriginal: "factura.pdf",
      mimetype: "application/pdf",
      tamaño: 1024,
      carteraArchivo: "/uploads/gastos/abc.pdf",
    });

    const result = await service.descargarEvidencia(1, 1, 7, adminContext);

    expect(result).toEqual({
      carteraArchivo: "/uploads/gastos/abc.pdf",
      mimetype: "application/pdf",
      nombreOriginal: "factura.pdf",
    });
    expect(evidenciaRepo.findOne).toHaveBeenCalledWith({
      where: { id: 7, gasto: { id: 1 } },
    });
  });

  it("un propietario no puede descargar la evidencia de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(service.descargarEvidencia(1, 1, 7, propietarioContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("descargarEvidencia lanza NotFound si el gasto no existe en la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.descargarEvidencia(1, 999, 7, adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("descargarEvidencia lanza NotFound si la evidencia no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (gastoRepo.findOne as jest.Mock).mockResolvedValue(gastoFixture());
    (evidenciaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.descargarEvidencia(1, 1, 999, adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });
});
