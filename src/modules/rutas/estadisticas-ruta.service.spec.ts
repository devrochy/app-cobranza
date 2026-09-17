import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EstadisticasConteos } from "../../domain/estadisticas-ruta";import { EstadisticasRutaService } from "./estadisticas-ruta.service";
import { Liquidacion } from "./liquidacion.entity";
import { Ruta } from "./ruta.entity";
import { RutaEstadisticasSnapshot } from "./ruta-estadisticas-snapshot.entity";

const actual: EstadisticasConteos = {
  totalClientes: 10,
  clientesAtrasados: 4,
  clientesVencidos: 3,
  sinVisitaHoy: 2,
  sinVisitaDesdeUltimaLiquidada: 5,
  conPrestamosNuevos: 1,
  conMasDeUnPrestamo: 2,
  clientesNuevos: 0,
};

describe("EstadisticasRutaService.obtener", () => {
  let service: EstadisticasRutaService;
  let rutaRepo: { findOne: jest.Mock };
  let snapshotRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };

  const snapshotDeAyer = { ...actual, totalClientes: 8, id: 1, rutaId: 3 };

  beforeEach(async () => {
    rutaRepo = { findOne: jest.fn().mockResolvedValue({ id: 3, socioId: 1 }) };
    snapshotRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => {
        throw new Error("sin fallback");
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EstadisticasRutaService,
        { provide: getRepositoryToken(Ruta), useValue: rutaRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(RutaEstadisticasSnapshot), useValue: snapshotRepo },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();

    service = moduleRef.get(EstadisticasRutaService);
    jest.spyOn(service, "calcular").mockResolvedValue(actual);
  });

  it("lanza NotFound si la ruta no existe", async () => {
    rutaRepo.findOne.mockResolvedValue(null);

    await expect(service.obtener(99, { rol: "admin", sub: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("lanza Forbidden si el socio no es dueño de la ruta", async () => {
    await expect(service.obtener(3, { rol: "socio", sub: 2 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("usa el snapshot de ayer como anterior", async () => {
    snapshotRepo.findOne.mockResolvedValue(snapshotDeAyer);

    const resultado = await service.obtener(3, { rol: "admin", sub: 1 });

    expect(resultado.actual).toEqual(actual);
    expect(resultado.anterior?.totalClientes).toBe(8);
    expect(resultado.deltas.totalClientes).toBe(2);
  });

  it("cae al último snapshot previo si no hay snapshot de ayer", async () => {
    snapshotRepo.findOne.mockResolvedValue(null);
    const getOne = jest.fn().mockResolvedValue({ ...actual, id: 9, rutaId: 3 });
    snapshotRepo.createQueryBuilder.mockReturnValue({
      where: () => ({
        andWhere: () => ({
          orderBy: () => ({ getOne }),
        }),
      }),
    });

    const resultado = await service.obtener(3, { rol: "admin", sub: 1 });

    expect(getOne).toHaveBeenCalled();
    expect(resultado.anterior).not.toBeNull();
    expect(resultado.deltas.totalClientes).toBe(0);
  });

  it("anterior y deltas null cuando no existe ningún snapshot", async () => {
    snapshotRepo.findOne.mockResolvedValue(null);
    snapshotRepo.createQueryBuilder.mockReturnValue({
      where: () => ({
        andWhere: () => ({
          orderBy: () => ({ getOne: jest.fn().mockResolvedValue(null) }),
        }),
      }),
    });

    const resultado = await service.obtener(3, { rol: "admin", sub: 1 });

    expect(resultado.anterior).toBeNull();
    expect(Object.values(resultado.deltas).every((d) => d === null)).toBe(true);
  });
});

describe("EstadisticasRutaService.persistirSnapshot", () => {
  let service: EstadisticasRutaService;
  let snapshotRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    snapshotRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((valor) => valor),
      save: jest.fn((valor) => Promise.resolve(valor)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EstadisticasRutaService,
        { provide: getRepositoryToken(Ruta), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(RutaEstadisticasSnapshot), useValue: snapshotRepo },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();

    service = moduleRef.get(EstadisticasRutaService);
    jest.spyOn(service, "calcular").mockResolvedValue(actual);
  });

  it("crea el snapshot cuando no existe y guarda los conteos", async () => {
    await service.persistirSnapshot(3, "2026-09-16");

    expect(snapshotRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ fecha: "2026-09-16", ...actual }),
    );
    expect(snapshotRepo.save).toHaveBeenCalled();
  });

  it("actualiza el snapshot existente (upsert)", async () => {
    const existente = { id: 1, fecha: "2026-09-16", totalClientes: 1 };
    snapshotRepo.findOne.mockResolvedValue(existente);

    const resultado = await service.persistirSnapshot(3, "2026-09-16");

    expect(resultado.totalClientes).toBe(10);
    expect(snapshotRepo.create).not.toHaveBeenCalled();
  });
});
