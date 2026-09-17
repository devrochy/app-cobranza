import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EstadisticasConteos } from "../../domain/estadisticas-cartera";import { EstadisticasCarteraService } from "./estadisticas-cartera.service";
import { Liquidacion } from "./liquidacion.entity";
import { Cartera } from "./cartera.entity";
import { CarteraEstadisticasSnapshot } from "./cartera-estadisticas-snapshot.entity";

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

describe("EstadisticasCarteraService.obtener", () => {
  let service: EstadisticasCarteraService;
  let carteraRepo: { findOne: jest.Mock };
  let snapshotRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };

  const snapshotDeAyer = { ...actual, totalClientes: 8, id: 1, carteraId: 3 };

  beforeEach(async () => {
    carteraRepo = { findOne: jest.fn().mockResolvedValue({ id: 3, propietarioId: 1 }) };
    snapshotRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => {
        throw new Error("sin fallback");
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EstadisticasCarteraService,
        { provide: getRepositoryToken(Cartera), useValue: carteraRepo },
        { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(CarteraEstadisticasSnapshot), useValue: snapshotRepo },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();

    service = moduleRef.get(EstadisticasCarteraService);
    jest.spyOn(service, "calcular").mockResolvedValue(actual);
  });

  it("lanza NotFound si la cartera no existe", async () => {
    carteraRepo.findOne.mockResolvedValue(null);

    await expect(service.obtener(99, { rol: "admin", sub: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("lanza Forbidden si el propietario no es dueño de la cartera", async () => {
    await expect(service.obtener(3, { rol: "propietario", sub: 2 })).rejects.toBeInstanceOf(
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
    const getOne = jest.fn().mockResolvedValue({ ...actual, id: 9, carteraId: 3 });
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

describe("EstadisticasCarteraService.persistirSnapshot", () => {
  let service: EstadisticasCarteraService;
  let snapshotRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    snapshotRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((valor) => valor),
      save: jest.fn((valor) => Promise.resolve(valor)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EstadisticasCarteraService,
        { provide: getRepositoryToken(Cartera), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Liquidacion), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(CarteraEstadisticasSnapshot), useValue: snapshotRepo },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();

    service = moduleRef.get(EstadisticasCarteraService);
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
