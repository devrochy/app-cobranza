import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Device } from "./device.entity";
import { SincronizacionOffline } from "./sincronizacion-offline.entity";
import { SincronizacionOfflineService } from "./sincronizacion-offline.service";

describe("SincronizacionOfflineService", () => {
  let service: SincronizacionOfflineService;
  let repo: Repository<SincronizacionOffline>;

  const device = { id: 1, codigo: "dev-1" } as Device;
  const UUID = "11111111-1111-4111-8111-111111111111";

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn((e: Partial<SincronizacionOffline>) => e as SincronizacionOffline),
    save: jest.fn(async (e: Partial<SincronizacionOffline>) => e as SincronizacionOffline),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockRepo.save as jest.Mock).mockImplementation(
      async (e: Partial<SincronizacionOffline>) => e as SincronizacionOffline,
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SincronizacionOfflineService,
        { provide: getRepositoryToken(SincronizacionOffline), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(SincronizacionOfflineService);
    repo = module.get(getRepositoryToken(SincronizacionOffline));
  });

  it("persiste un evento nuevo como sincronizado y lo reporta", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);

    const resultados = await service.ingestir(device, [
      { eventoIdCliente: UUID, tipoEvento: "visita", payload: { rutaId: 1 } },
    ]);

    expect(resultados).toEqual([{ eventoIdCliente: UUID, estado: "sincronizado" }]);
    const guardado = (mockRepo.save as jest.Mock).mock.calls[0][0] as Partial<SincronizacionOffline>;
    expect(guardado.dispositivoId).toBe(1);
    expect(guardado.eventoIdCliente).toBe(UUID);
    expect(guardado.tipoEvento).toBe("visita");
    expect(guardado.estado).toBe("sincronizado");
    expect(guardado.syncedAt).toBeInstanceOf(Date);
  });

  it("no vuelve a persistir un evento duplicado (mismo dispositivo + eventoIdCliente)", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({ id: 9 });

    const resultados = await service.ingestir(device, [
      { eventoIdCliente: UUID, tipoEvento: "visita", payload: {} },
    ]);

    expect(resultados).toEqual([{ eventoIdCliente: UUID, estado: "duplicado" }]);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("marca error si el tipo de evento no está en el catálogo", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);

    const resultados = await service.ingestir(device, [
      { eventoIdCliente: UUID, tipoEvento: "no-existe", payload: {} },
    ]);

    expect(resultados[0].estado).toBe("error");
    expect(resultados[0].error).toBeDefined();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("marca error si eventoIdCliente no es un uuid válido", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);

    const resultados = await service.ingestir(device, [
      { eventoIdCliente: "no-es-uuid", tipoEvento: "visita", payload: {} },
    ]);

    expect(resultados[0].estado).toBe("error");
  });

  it("trata una violación de unicidad (23505) como duplicado (carrera)", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    (mockRepo.save as jest.Mock).mockRejectedValue({ code: "23505" });

    const resultados = await service.ingestir(device, [
      { eventoIdCliente: UUID, tipoEvento: "visita", payload: {} },
    ]);

    expect(resultados).toEqual([{ eventoIdCliente: UUID, estado: "duplicado" }]);
  });

  it("procesa un lote mixto manteniendo el orden", async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    const uuidB = "22222222-2222-4222-8222-222222222222";
    const resultados = await service.ingestir(device, [
      { eventoIdCliente: UUID, tipoEvento: "pago", payload: {} },
      { eventoIdCliente: uuidB, tipoEvento: "gasto", payload: {} },
    ]);
    expect(resultados[0].estado).toBe("sincronizado");
    expect(resultados[1].estado).toBe("sincronizado");
    expect(mockRepo.save).toHaveBeenCalledTimes(2);
  });
});