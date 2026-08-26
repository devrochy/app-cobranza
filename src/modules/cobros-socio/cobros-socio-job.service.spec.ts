import { Test, TestingModule } from "@nestjs/testing";
import { CobrosSocioService } from "./cobros-socio.service";
import { CobrosSocioJob } from "./cobros-socio-job.service";
import { NotificacionesSocioService } from "./notificaciones-socio.service";
import { SocioMoraService } from "./socio-mora.service";

describe("CobrosSocioJob", () => {
  let job: CobrosSocioJob;
  let service: CobrosSocioService;
  let notificaciones: NotificacionesSocioService;
  let socioMora: SocioMoraService;

  const mockService = {
    generarCobrosDelDia: jest.fn().mockResolvedValue(1),
    marcarVencidos: jest.fn().mockResolvedValue(0),
  };
  const mockNotificaciones = {
    ejecutarCiclo: jest.fn().mockResolvedValue(undefined),
  };
  const mockSocioMora = {
    bloquearMorosos: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobrosSocioJob,
        { provide: CobrosSocioService, useValue: mockService },
        { provide: NotificacionesSocioService, useValue: mockNotificaciones },
        { provide: SocioMoraService, useValue: mockSocioMora },
      ],
    }).compile();

    job = module.get(CobrosSocioJob);
    service = module.get(CobrosSocioService);
    notificaciones = module.get(NotificacionesSocioService);
    socioMora = module.get(SocioMoraService);
  });

  it("genera cobros, marca vencidos, dispara notificaciones y bloquea morosos", async () => {
    await job.handleCron();
    expect(service.generarCobrosDelDia).toHaveBeenCalled();
    expect(service.marcarVencidos).toHaveBeenCalled();
    expect(notificaciones.ejecutarCiclo).toHaveBeenCalled();
    expect(socioMora.bloquearMorosos).toHaveBeenCalled();
  });
});