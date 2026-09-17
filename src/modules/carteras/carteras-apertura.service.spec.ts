import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Cartera } from "./cartera.entity";
import { CarteraApertura } from "./cartera-apertura.entity";
import { CarterasAperturaService } from "./carteras-apertura.service";

describe("CarterasAperturaService", () => {
  let service: CarterasAperturaService;
  let carteraRepo: { findOne: jest.Mock };
  let aperturaRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  const requester = { rol: "gestor" as const, sub: 20 };

  beforeEach(async () => {
    jest.clearAllMocks();
    carteraRepo = { findOne: jest.fn() };
    aperturaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 1, ...e })),
      create: jest.fn().mockImplementation((e) => e),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarterasAperturaService,
        { provide: getRepositoryToken(Cartera), useValue: carteraRepo },
        { provide: getRepositoryToken(CarteraApertura), useValue: aperturaRepo },
      ],
    }).compile();

    service = module.get(CarterasAperturaService);
  });

  it("registra la apertura de la cartera con fecha, hora y coordenadas", async () => {
    carteraRepo.findOne.mockResolvedValue({ id: 6, gestorId: 20 });
    const hoy = new Date("2026-09-02T14:30:00");

    await service.registrar(
      6,
      { latitud: -17.78, longitud: -63.18 },
      requester,
      hoy,
    );

    expect(carteraRepo.findOne).toHaveBeenCalledWith({ where: { id: 6 } });
    expect(aperturaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cartera: { id: 6 },
        carteraId: 6,
        fecha: "2026-09-02",
        horaInicio: "14:30",
        latitud: -17.78,
        longitud: -63.18,
      }),
    );
  });

  it("rechaza si la cartera no existe", async () => {
    carteraRepo.findOne.mockResolvedValue(null);

    await expect(
      service.registrar(6, { latitud: -17.78, longitud: -63.18 }, requester),
    ).rejects.toThrow(NotFoundException);
  });

  it("rechaza una cartera ajena (403 por ownership)", async () => {
    carteraRepo.findOne.mockResolvedValue({ id: 6, gestorId: 99 });

    await expect(
      service.registrar(6, { latitud: -17.78, longitud: -63.18 }, requester),
    ).rejects.toThrow(/Acceso denegado/);
  });
});