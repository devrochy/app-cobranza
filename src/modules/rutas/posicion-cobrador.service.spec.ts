import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { In } from "typeorm";
import { Ruta } from "./ruta.entity";
import { PosicionCobrador } from "./posicion-cobrador.entity";
import { PosicionCobradorService } from "./posicion-cobrador.service";

describe("PosicionCobradorService", () => {
  let service: PosicionCobradorService;
  let rutaRepo: { findOne: jest.Mock; find: jest.Mock };
  let posicionRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const requester = { rol: "cobrador" as const, sub: 20 };

  beforeEach(async () => {
    rutaRepo = { findOne: jest.fn(), find: jest.fn() };
    posicionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((e: Partial<PosicionCobrador>) => e as PosicionCobrador),
      save: jest.fn(async (e: Partial<PosicionCobrador>) => ({
        id: 1,
        registradaEn: new Date(),
        ...e,
      }) as PosicionCobrador),
    };
    const module = await Test.createTestingModule({
      providers: [
        PosicionCobradorService,
        { provide: getRepositoryToken(Ruta), useValue: rutaRepo },
        { provide: getRepositoryToken(PosicionCobrador), useValue: posicionRepo },
      ],
    }).compile();
    service = module.get(PosicionCobradorService);
  });

  it("registra la primera posición del cobrador en la ruta", async () => {
    rutaRepo.findOne.mockResolvedValue({
      id: 6,
      nombre: "Ruta Centro",
      cobradorId: 20,
      cobrador: { id: 20, nombre: "Carlos", apellido: "Lopez" },
    });
    posicionRepo.findOne.mockResolvedValue(null);

    const res = await service.registrar(6, { latitud: 5.07, longitud: -75.52 }, requester);

    expect(posicionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cobradorId: 20, rutaId: 6, latitud: 5.07, longitud: -75.52 }),
    );
    expect(res).toMatchObject({
      cobradorId: 20,
      cobradorNombre: "Carlos Lopez",
      rutaNombre: "Ruta Centro",
      latitud: 5.07,
      longitud: -75.52,
    });
  });

  it("actualiza la última posición existente (upsert)", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 6, nombre: "Ruta Centro", cobradorId: 20, cobrador: null });
    posicionRepo.findOne.mockResolvedValue({ id: 9, cobradorId: 20, rutaId: 6, latitud: 5.0, longitud: -75.5 });

    await service.registrar(6, { latitud: 5.1, longitud: -75.6 }, requester);

    expect(posicionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, latitud: 5.1, longitud: -75.6 }),
    );
  });

  it("lanza NotFound si la ruta no existe", async () => {
    rutaRepo.findOne.mockResolvedValue(null);

    await expect(
      service.registrar(999, { latitud: 5.07, longitud: -75.52 }, requester),
    ).rejects.toThrow(NotFoundException);
  });

  it("ultimasDelSocio devuelve las posiciones de las rutas del socio", async () => {
    rutaRepo.find.mockResolvedValue([
      { id: 6, nombre: "Ruta Centro", cobrador: { id: 20, nombre: "Carlos", apellido: "Lopez" } },
    ]);
    posicionRepo.find.mockResolvedValue([
      { cobradorId: 20, rutaId: 6, latitud: 5.07, longitud: -75.52, registradaEn: new Date() },
    ]);

    const res = await service.ultimasDelSocio(1, { rol: "socio", sub: 1 });

    expect(posicionRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ruta: { id: In([6]) } } }),
    );
    expect(res[0]).toMatchObject({ cobradorNombre: "Carlos Lopez", latitud: 5.07 });
  });
});