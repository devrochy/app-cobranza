import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, LessThan, Repository } from "typeorm";
import { Cuota } from "./cuota.entity";
import { MoraJobService } from "./mora-job.service";
import { ColorRiesgoService } from "./color-riesgo.service";

describe("MoraJobService", () => {
  let service: MoraJobService;
  let cuotaRepo: Repository<Cuota>;

  const mockCuotaRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };
  const mockColorRiesgo = { recalcularSeguro: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({ getRepository: jest.fn(() => mockCuotaRepo) }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoraJobService,
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ColorRiesgoService, useValue: mockColorRiesgo },
      ],
    }).compile();

    service = module.get(MoraJobService);
    cuotaRepo = module.get(getRepositoryToken(Cuota));
  });

  it("marca como atrasadas las cuotas pendientes con vencimiento anterior a hoy", async () => {
    const hoy = new Date("2026-08-17T00:00:00Z");
    const vencida = {
      id: 1,
      numeroCuota: 1,
      estatus: "pendiente" as const,
      fechaVencimiento: "2026-08-10",
    };
    // El repo simula el filtro LessThan(fechaHoy): solo devuelve la vencida.
    (cuotaRepo.find as jest.Mock).mockResolvedValue([vencida]);

    await service.ejecutar(hoy);

    expect(cuotaRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estatus: "pendiente", fechaVencimiento: LessThan("2026-08-17") },
      }),
    );
    expect(cuotaRepo.save).toHaveBeenCalledWith([expect.objectContaining({ id: 1, estatus: "atrasada" })]);
  });

  it("no persiste nada si no hay cuotas vencidas", async () => {
    (cuotaRepo.find as jest.Mock).mockResolvedValue([]);

    await service.ejecutar(new Date("2026-08-17T00:00:00Z"));

    expect(cuotaRepo.save).not.toHaveBeenCalled();
  });

  it("no marca como atrasada una cuota que vence hoy (mora desde el día siguiente)", async () => {
    const hoy = new Date("2026-08-17T00:00:00Z");
    // El repo aplica LessThan(fechaHoy); una cuota con vencimiento == hoy no
    // es devuelta por el filtro, por lo que no debe marcarse.
    (cuotaRepo.find as jest.Mock).mockResolvedValue([]);

    const marcadas = await service.ejecutar(hoy);

    expect(cuotaRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estatus: "pendiente", fechaVencimiento: LessThan("2026-08-17") },
      }),
    );
    expect(marcadas).toBe(0);
    expect(cuotaRepo.save).not.toHaveBeenCalled();
  });

  it("ejecutar() devuelve el número de cuotas marcadas", async () => {
    (cuotaRepo.find as jest.Mock).mockResolvedValue([{ id: 1, estatus: "pendiente", fechaVencimiento: "2026-08-10" }]);
    const resultado = await service.ejecutar(new Date("2026-08-17T00:00:00Z"));
    expect(resultado).toBe(1);
  });

  it("recalcula el color de riesgo de los clientes afectados", async () => {
    const vencida = {
      id: 1,
      numeroCuota: 1,
      estatus: "pendiente" as const,
      fechaVencimiento: "2026-08-10",
      prestamo: { cliente: { id: 7 }, ruta: { id: 3 } },
    };
    (cuotaRepo.find as jest.Mock).mockResolvedValue([vencida]);

    await service.ejecutar(new Date("2026-08-17T00:00:00Z"));

    expect(mockColorRiesgo.recalcularSeguro).toHaveBeenCalledWith(7, 3, expect.anything());
  });
});
