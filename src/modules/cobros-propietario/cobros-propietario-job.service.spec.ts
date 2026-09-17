import { Test, TestingModule } from "@nestjs/testing";
import { CobrosPropietarioService } from "./cobros-propietario.service";
import { CobrosPropietarioJob } from "./cobros-propietario-job.service";
import { NotificacionesPropietarioService } from "./notificaciones-propietario.service";
import { PropietarioMoraService } from "./propietario-mora.service";

describe("CobrosPropietarioJob", () => {
  let job: CobrosPropietarioJob;
  let service: CobrosPropietarioService;
  let notificaciones: NotificacionesPropietarioService;
  let propietarioMora: PropietarioMoraService;

  const mockService = {
    generarCobrosDelDia: jest.fn().mockResolvedValue(1),
    marcarVencidos: jest.fn().mockResolvedValue(0),
  };
  const mockNotificaciones = {
    ejecutarCiclo: jest.fn().mockResolvedValue(undefined),
  };
  const mockPropietarioMora = {
    bloquearMorosos: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobrosPropietarioJob,
        { provide: CobrosPropietarioService, useValue: mockService },
        { provide: NotificacionesPropietarioService, useValue: mockNotificaciones },
        { provide: PropietarioMoraService, useValue: mockPropietarioMora },
      ],
    }).compile();

    job = module.get(CobrosPropietarioJob);
    service = module.get(CobrosPropietarioService);
    notificaciones = module.get(NotificacionesPropietarioService);
    propietarioMora = module.get(PropietarioMoraService);
  });

  it("genera cobros, marca vencidos, dispara notificaciones y bloquea morosos", async () => {
    await job.handleCron();
    expect(service.generarCobrosDelDia).toHaveBeenCalled();
    expect(service.marcarVencidos).toHaveBeenCalled();
    expect(notificaciones.ejecutarCiclo).toHaveBeenCalled();
    expect(propietarioMora.bloquearMorosos).toHaveBeenCalled();
  });
});