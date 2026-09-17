import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { In } from "typeorm";
import { Cartera } from "./cartera.entity";
import { PosicionGestor } from "./posicion-gestor.entity";
import { PosicionGestorService } from "./posicion-gestor.service";

describe("PosicionGestorService", () => {
  let service: PosicionGestorService;
  let carteraRepo: { findOne: jest.Mock; find: jest.Mock };
  let posicionRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const requester = { rol: "gestor" as const, sub: 20 };

  beforeEach(async () => {
    carteraRepo = { findOne: jest.fn(), find: jest.fn() };
    posicionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((e: Partial<PosicionGestor>) => e as PosicionGestor),
      save: jest.fn(async (e: Partial<PosicionGestor>) => ({
        id: 1,
        registradaEn: new Date(),
        ...e,
      }) as PosicionGestor),
    };
    const module = await Test.createTestingModule({
      providers: [
        PosicionGestorService,
        { provide: getRepositoryToken(Cartera), useValue: carteraRepo },
        { provide: getRepositoryToken(PosicionGestor), useValue: posicionRepo },
      ],
    }).compile();
    service = module.get(PosicionGestorService);
  });

  it("registra la primera posición del gestor en la cartera", async () => {
    carteraRepo.findOne.mockResolvedValue({
      id: 6,
      nombre: "Cartera Centro",
      gestorId: 20,
      gestor: { id: 20, nombre: "Carlos", apellido: "Lopez" },
    });
    posicionRepo.findOne.mockResolvedValue(null);

    const res = await service.registrar(6, { latitud: 5.07, longitud: -75.52 }, requester);

    expect(posicionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ gestorId: 20, carteraId: 6, latitud: 5.07, longitud: -75.52 }),
    );
    expect(res).toMatchObject({
      gestorId: 20,
      gestorNombre: "Carlos Lopez",
      carteraNombre: "Cartera Centro",
      latitud: 5.07,
      longitud: -75.52,
    });
  });

  it("actualiza la última posición existente (upsert)", async () => {
    carteraRepo.findOne.mockResolvedValue({
      id: 6,
      nombre: "Cartera Centro",
      gestorId: 20,
      gestor: { id: 20, nombre: "Carlos", apellido: "Lopez" },
    });
    posicionRepo.findOne.mockResolvedValue({ id: 9, gestorId: 20, carteraId: 6, latitud: 5.0, longitud: -75.5 });

    await service.registrar(6, { latitud: 5.1, longitud: -75.6 }, requester);

    expect(posicionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, latitud: 5.1, longitud: -75.6 }),
    );
  });

  it("guarda bajo el gestor de la cartera cuando quien envía es un propietario", async () => {
    carteraRepo.findOne.mockResolvedValue({
      id: 6,
      nombre: "Cartera Centro",
      propietarioId: 99,
      gestorId: 20,
      gestor: { id: 20, nombre: "Carlos", apellido: "Lopez" },
    });
    posicionRepo.findOne.mockResolvedValue(null);

    const res = await service.registrar(
      6,
      { latitud: 5.07, longitud: -75.52 },
      { rol: "propietario", sub: 99 },
    );

    expect(posicionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ gestorId: 20, carteraId: 6 }),
    );
    expect(posicionRepo.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ gestorId: 99 }),
    );
    expect(res.gestorId).toBe(20);
  });

  it("no persiste nada si la cartera no tiene gestor", async () => {
    carteraRepo.findOne.mockResolvedValue({
      id: 6,
      nombre: "Cartera Centro",
      propietarioId: 99,
      gestorId: null,
      gestor: null,
    });
    posicionRepo.findOne.mockResolvedValue(null);

    const res = await service.registrar(
      6,
      { latitud: 5.07, longitud: -75.52 },
      { rol: "propietario", sub: 99 },
    );

    expect(posicionRepo.save).not.toHaveBeenCalled();
    expect(posicionRepo.create).not.toHaveBeenCalled();
    expect(res).toMatchObject({ carteraId: 6, latitud: 5.07, longitud: -75.52 });
  });

  it("lanza NotFound si la cartera no existe", async () => {
    carteraRepo.findOne.mockResolvedValue(null);

    await expect(
      service.registrar(999, { latitud: 5.07, longitud: -75.52 }, requester),
    ).rejects.toThrow(NotFoundException);
  });

  it("ultimasDelPropietario devuelve las posiciones de las carteras del propietario", async () => {
    carteraRepo.find.mockResolvedValue([
      { id: 6, nombre: "Cartera Centro", gestor: { id: 20, nombre: "Carlos", apellido: "Lopez" } },
    ]);
    posicionRepo.find.mockResolvedValue([
      { gestorId: 20, carteraId: 6, latitud: 5.07, longitud: -75.52, registradaEn: new Date() },
    ]);

    const res = await service.ultimasDelPropietario(1, { rol: "propietario", sub: 1 });

    expect(posicionRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cartera: { id: In([6]) } } }),
    );
    expect(res[0]).toMatchObject({ gestorNombre: "Carlos Lopez", latitud: 5.07 });
  });
});