import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { ColorRiesgoService } from "./color-riesgo.service";

describe("ColorRiesgoService", () => {
  let service: ColorRiesgoService;
  let clienteRepo: Repository<Cliente>;
  let cuotaRepo: Repository<Cuota>;
  let configRepo: Repository<RutaConfig>;

  const mockClienteRepo = { update: jest.fn() };
  const mockCuotaRepo = { count: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColorRiesgoService,
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
      ],
    }).compile();

    service = module.get(ColorRiesgoService);
    clienteRepo = module.get(getRepositoryToken(Cliente));
    cuotaRepo = module.get(getRepositoryToken(Cuota));
    configRepo = module.get(getRepositoryToken(RutaConfig));
  });

  it("marca rojo cuando el atraso alcanza el umbral", async () => {
    (cuotaRepo.count as jest.Mock)
      .mockResolvedValueOnce(2) // atrasadas
      .mockResolvedValueOnce(5); // no pagadas
    (configRepo.findOne as jest.Mock).mockResolvedValue({ cuotasAtrasoUmbral: 1 } as RutaConfig);

    const color = await service.recalcular(10, 1);

    expect(color).toBe("rojo");
    expect(clienteRepo.update).toHaveBeenCalledWith({ id: 10 }, { colorRiesgo: "rojo" });
  });

  it("marca azul cuando el atraso está bajo el umbral", async () => {
    (cuotaRepo.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5);
    (configRepo.findOne as jest.Mock).mockResolvedValue({ cuotasAtrasoUmbral: 1 } as RutaConfig);

    expect(await service.recalcular(10, 1)).toBe("azul");
  });

  it("marca blanco cuando no quedan cuotas pendientes ni atrasadas", async () => {
    (cuotaRepo.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (configRepo.findOne as jest.Mock).mockResolvedValue({ cuotasAtrasoUmbral: 1 } as RutaConfig);

    expect(await service.recalcular(10, 1)).toBe("blanco");
  });
});
