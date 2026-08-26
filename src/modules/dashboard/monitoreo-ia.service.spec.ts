import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConversacionIa } from "../cartera/conversacion-ia.entity";
import { MonitoreoIaService } from "./monitoreo-ia.service";

describe("MonitoreoIaService", () => {
  let service: MonitoreoIaService;
  let conversacionRepo: Repository<ConversacionIa>;

  const conversacion = (overrides: Partial<ConversacionIa> = {}) =>
    ({
      id: 1,
      estado: "derivada",
      motivoDerivacion: "queja",
      createdAt: new Date("2026-08-26T00:00:00Z"),
      cliente: { id: 5, nombre: "Ana", apellido: "Pérez" } as never,
      ...overrides,
    }) as ConversacionIa;

  const mockRepo = { count: jest.fn(), find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoreoIaService,
        { provide: getRepositoryToken(ConversacionIa), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(MonitoreoIaService);
    conversacionRepo = module.get(getRepositoryToken(ConversacionIa));
  });

  it("devuelve los conteos por estado y las derivadas recientes", async () => {
    (mockRepo.count as jest.Mock).mockResolvedValue(10);
    (mockRepo.find as jest.Mock).mockResolvedValue([
      conversacion({ id: 1 }),
      conversacion({ id: 2, motivoDerivacion: "disputa", cliente: { id: 6, nombre: "Luis", apellido: "Mora" } as never }),
    ]);

    const result = await service.obtener();

    expect(result.activas).toBe(10);
    expect(result.derivadas).toBe(10);
    expect(result.resueltas).toBe(10);
    expect(conversacionRepo.count).toHaveBeenCalledWith({ where: { estado: "activa" } });
    expect(conversacionRepo.count).toHaveBeenCalledWith({ where: { estado: "derivada" } });
    expect(conversacionRepo.count).toHaveBeenCalledWith({ where: { estado: "resuelta" } });

    expect(result.derivadasRecientes).toHaveLength(2);
    expect(result.derivadasRecientes[0].cliente).toBe("Ana Pérez");
    expect(result.derivadasRecientes[0].motivo).toBe("queja");
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: "derivada" }, take: 10 }),
    );
  });
});