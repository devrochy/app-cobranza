import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AlertasService } from "./alertas.service";
import { IntentoAcceso } from "./intento-acceso.entity";
import { IntentosAccesoService } from "./intentos-acceso.service";

describe("IntentosAccesoService", () => {
  let service: IntentosAccesoService;
  let repo: Repository<IntentoAcceso>;
  let alertas: AlertasService;

  const mockRepo = {
    create: jest.fn((input: Partial<IntentoAcceso>) => input),
    save: jest.fn((e: Partial<IntentoAcceso>) => ({ id: 1, ...e })),
    find: jest.fn(),
  };
  const mockAlertas = {
    notificarIntentoNoAutorizado: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentosAccesoService,
        { provide: getRepositoryToken(IntentoAcceso), useValue: mockRepo },
        { provide: AlertasService, useValue: mockAlertas },
      ],
    }).compile();

    service = module.get(IntentosAccesoService);
    repo = module.get(getRepositoryToken(IntentoAcceso));
    alertas = module.get(AlertasService);
  });

  it("registra el intento y dispara la alerta", async () => {
    const input = {
      cobradorId: 20,
      imei: "imei-x",
      whatsappNumber: "+59171111111",
      motivo: "imei_no_coincide" as const,
    };

    const result = await service.registrar(input);

    expect(repo.create).toHaveBeenCalledWith(input);
    expect(repo.save).toHaveBeenCalled();
    expect(alertas.notificarIntentoNoAutorizado).toHaveBeenCalledWith({
      cobradorId: 20,
      imei: "imei-x",
      whatsappNumber: "+59171111111",
      motivo: "imei_no_coincide",
    });
    expect(result.id).toBe(1);
  });

  it("lista los intentos ordenados de forma descendente", async () => {
    const filas = [{ id: 2 }, { id: 1 }];
    mockRepo.find.mockResolvedValue(filas);

    await expect(service.listar()).resolves.toEqual(filas);
    expect(repo.find).toHaveBeenCalledWith({ order: { id: "DESC" } });
  });
});
