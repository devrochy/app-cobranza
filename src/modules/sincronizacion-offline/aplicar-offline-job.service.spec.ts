import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AplicarEventosOfflineService } from "./aplicar-eventos-offline.service";
import { AplicarOfflineJob } from "./aplicar-offline-job.service";
import { Device } from "./device.entity";

describe("AplicarOfflineJob", () => {
  let job: AplicarOfflineJob;
  let deviceRepo: { find: jest.Mock };
  let aplicarService: { aplicarPendientesDeDispositivo: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    deviceRepo = { find: jest.fn() };
    aplicarService = { aplicarPendientesDeDispositivo: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AplicarOfflineJob,
        { provide: getRepositoryToken(Device), useValue: deviceRepo },
        { provide: AplicarEventosOfflineService, useValue: aplicarService },
      ],
    }).compile();

    job = module.get(AplicarOfflineJob);
  });

  it("reintenta los pendientes de cada dispositivo activo con ruta", async () => {
    deviceRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    aplicarService.aplicarPendientesDeDispositivo.mockResolvedValue(undefined);

    await job.reintentarPendientes();

    expect(deviceRepo.find).toHaveBeenCalledWith({
      where: { estado: "activo", rutaId: expect.anything() },
    });
    expect(aplicarService.aplicarPendientesDeDispositivo).toHaveBeenCalledTimes(2);
  });

  it("continúa con el siguiente dispositivo si uno falla", async () => {
    deviceRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    aplicarService.aplicarPendientesDeDispositivo
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    await expect(job.reintentarPendientes()).resolves.toBeUndefined();
    expect(aplicarService.aplicarPendientesDeDispositivo).toHaveBeenCalledTimes(2);
  });
});