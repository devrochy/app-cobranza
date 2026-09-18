import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { NotificacionesFeedService } from "./notificaciones-feed.service";

describe("NotificacionesFeedService", () => {
  let service: NotificacionesFeedService;
  let carteraRepo: Repository<Cartera>;

  const mockCarteraRepo = { find: jest.fn() };
  const mockDataSource = { query: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesFeedService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(NotificacionesFeedService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
  });

  it("devuelve los eventos mapeados y scoped a las carteras del gestor", async () => {
    (carteraRepo.find as jest.Mock).mockResolvedValue([{ id: 10 }, { id: 11 }]);
    (mockDataSource.query as jest.Mock).mockResolvedValue([
      {
        tipo: "pago",
        refId: 5,
        carteraId: 10,
        carteraNombre: "Centro",
        clienteId: 7,
        clienteNombre: "Ana Ruiz",
        monto: "150.00",
        detalle: null,
        fecha: "2026-09-17T10:00:00.000Z",
      },
      {
        tipo: "liquidacion",
        refId: 3,
        carteraId: 11,
        carteraNombre: "Norte",
        clienteId: null,
        clienteNombre: null,
        monto: "500.00",
        detalle: "diario",
        fecha: "2026-09-17T09:00:00.000Z",
      },
    ]);

    const res = await service.listar({ rol: "gestor", sub: 20 });

    expect(carteraRepo.find).toHaveBeenCalledWith({ where: { gestor: { id: 20 } } });
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining("UNION ALL"),
      [[10, 11], 30],
    );
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      id: "pago-5",
      tipo: "pago",
      carteraId: 10,
      clienteId: 7,
      monto: 150,
    });
    expect(res[0].mensaje).toContain("Ana Ruiz");
    expect(res[1]).toMatchObject({
      id: "liquidacion-3",
      tipo: "liquidacion",
      carteraId: 11,
      clienteId: null,
      monto: 500,
    });
  });

  it("devuelve [] sin consultar si el requester no tiene carteras", async () => {
    (carteraRepo.find as jest.Mock).mockResolvedValue([]);

    const res = await service.listar({ rol: "gestor", sub: 20 });

    expect(res).toEqual([]);
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it("un propietario scopea por propietario", async () => {
    (carteraRepo.find as jest.Mock).mockResolvedValue([]);

    await service.listar({ rol: "propietario", sub: 3 });

    expect(carteraRepo.find).toHaveBeenCalledWith({ where: { propietario: { id: 3 } } });
  });

  it("respeta el límite recibido", async () => {
    (carteraRepo.find as jest.Mock).mockResolvedValue([{ id: 10 }]);
    (mockDataSource.query as jest.Mock).mockResolvedValue([]);

    await service.listar({ rol: "gestor", sub: 20 }, 5);

    expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), [[10], 5]);
  });
});
