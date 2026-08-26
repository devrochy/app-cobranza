import { Test, TestingModule } from "@nestjs/testing";
import { CobrosSocioService } from "./cobros-socio.service";
import { CobrosSocioJob } from "./cobros-socio-job.service";
import { NotificacionesSocioService } from "./notificaciones-socio.service";

describe("CobrosSocioJob", () => {
  let job: CobrosSocioJob;
  let service: CobrosSocioService;
  let notificaciones: NotificacionesSocioService;

  const mockService = {
    generarCobrosDelDia: jest.fn().mockResolvedValue(1),
    marcarVencidos: jest.fn().mockResolvedValue(0),
  };
  const mockNotificaciones = {
    ejecutarCiclo: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobrosSocioJob,
        { provide: CobrosSocioService, useValue: mockService },
        { provide: NotificacionesSocioService, useValue: mockNotificaciones },
      ],
    }).compile();

    job = module.get(CobrosSocioJob);
    service = module.get(CobrosSocioService);
    notificaciones = module.get(NotificacionesSocioService);
  });

  it("genera los cobros del día, marca los vencidos y dispara el ciclo de notificaciones", async () => {
    await job.handleCron();
    expect(service.generarCobrosDelDia).toHaveBeenCalled();
    expect(service.marcarVencidos).toHaveBeenCalled();
    expect(notificaciones.ejecutarCiclo).toHaveBeenCalled();
  });
});