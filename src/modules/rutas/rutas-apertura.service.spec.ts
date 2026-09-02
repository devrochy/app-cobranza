import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Ruta } from "./ruta.entity";
import { RutaApertura } from "./ruta-apertura.entity";
import { RutasAperturaService } from "./rutas-apertura.service";

describe("RutasAperturaService", () => {
  let service: RutasAperturaService;
  let rutaRepo: { findOne: jest.Mock };
  let aperturaRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  const requester = { rol: "cobrador" as const, sub: 20 };

  beforeEach(async () => {
    jest.clearAllMocks();
    rutaRepo = { findOne: jest.fn() };
    aperturaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 1, ...e })),
      create: jest.fn().mockImplementation((e) => e),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RutasAperturaService,
        { provide: getRepositoryToken(Ruta), useValue: rutaRepo },
        { provide: getRepositoryToken(RutaApertura), useValue: aperturaRepo },
      ],
    }).compile();

    service = module.get(RutasAperturaService);
  });

  it("registra la apertura de la ruta con fecha, hora y coordenadas", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 6, cobradorId: 20 });
    const hoy = new Date("2026-09-02T14:30:00");

    await service.registrar(
      6,
      { latitud: -17.78, longitud: -63.18 },
      requester,
      hoy,
    );

    expect(rutaRepo.findOne).toHaveBeenCalledWith({ where: { id: 6 } });
    expect(aperturaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ruta: { id: 6 },
        rutaId: 6,
        fecha: "2026-09-02",
        horaInicio: "14:30",
        latitud: -17.78,
        longitud: -63.18,
      }),
    );
  });

  it("rechaza si la ruta no existe", async () => {
    rutaRepo.findOne.mockResolvedValue(null);

    await expect(
      service.registrar(6, { latitud: -17.78, longitud: -63.18 }, requester),
    ).rejects.toThrow(NotFoundException);
  });

  it("rechaza una ruta ajena (403 por ownership)", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 6, cobradorId: 99 });

    await expect(
      service.registrar(6, { latitud: -17.78, longitud: -63.18 }, requester),
    ).rejects.toThrow(/Acceso denegado/);
  });
});