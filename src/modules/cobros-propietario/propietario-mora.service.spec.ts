import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PropietariosService } from "../propietarios/propietarios.service";
import { CobroPropietario } from "./cobro-propietario.entity";
import { PropietarioMoraService } from "./propietario-mora.service";

describe("PropietarioMoraService", () => {
  let service: PropietarioMoraService;
  let cobroRepo: Repository<CobroPropietario>;
  let propietariosService: PropietariosService;

  const hoy = new Date("2026-08-26T00:00:00Z");

  const propietario = (overrides: Partial<{ id: number; estatus: string; diasToleranciaCobro: number }> = {}) =>
    ({
      id: 1,
      estatus: "activo",
      diasToleranciaCobro: 5,
      ...overrides,
    }) as never;

  const cobro = (overrides: Partial<CobroPropietario> = {}) =>
    ({
      id: 1,
      propietarioId: 1,
      periodo: "2026-08",
      fechaVencimiento: "2026-08-15",
      estado: "pendiente",
      propietario: propietario(),
      ...overrides,
    }) as CobroPropietario;

  const mockCobroRepo = { find: jest.fn() };
  const mockPropietariosService = {
    obtener: jest.fn(),
    setEstatus: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropietarioMoraService,
        { provide: getRepositoryToken(CobroPropietario), useValue: mockCobroRepo },
        { provide: PropietariosService, useValue: mockPropietariosService },
      ],
    }).compile();

    service = module.get(PropietarioMoraService);
    cobroRepo = module.get(getRepositoryToken(CobroPropietario));
    propietariosService = module.get(PropietariosService);
  });

  describe("bloquearMorosos", () => {
    it("consulta cobros no pagados con su propietario", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([]);
      await service.bloquearMorosos(hoy);
      expect(cobroRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { propietario: true } }),
      );
    });

    it("bloquea un propietario activo con un cobro vencido más allá de la tolerancia", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([cobro()]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(1);
      expect(propietariosService.setEstatus).toHaveBeenCalledWith(1, "bloqueado");
    });

    it("no bloquea si el cobro está dentro de la tolerancia", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ fechaVencimiento: "2026-08-24" }),
      ]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(0);
      expect(propietariosService.setEstatus).not.toHaveBeenCalled();
    });

    it("no bloquea un propietario ya bloqueado aunque tenga morosidad", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ propietario: propietario({ estatus: "bloqueado" }) }),
      ]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(0);
      expect(propietariosService.setEstatus).not.toHaveBeenCalled();
    });

    it("ignora cobros pagados viejos", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ estado: "pagado", fechaVencimiento: "2026-07-15" }),
      ]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(0);
      expect(propietariosService.setEstatus).not.toHaveBeenCalled();
    });

    it("bloquea una sola vez por propietario aunque tenga varios cobros morosos", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 1 }),
        cobro({ id: 2, periodo: "2026-07", fechaVencimiento: "2026-07-15" }),
      ]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(1);
      expect(propietariosService.setEstatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("habilitarSiSinMorosidad", () => {
    it("re-activa un propietario bloqueado si ya no queda ningún cobro moroso", async () => {
      (propietariosService.obtener as jest.Mock).mockResolvedValue(
        propietario({ id: 1, estatus: "bloqueado", diasToleranciaCobro: 5 }),
      );
      (cobroRepo.find as jest.Mock).mockResolvedValue([]);

      const habilitado = await service.habilitarSiSinMorosidad(1, hoy);

      expect(habilitado).toBe(true);
      expect(propietariosService.setEstatus).toHaveBeenCalledWith(1, "activo");
    });

    it("re-activa si el único cobro restante está dentro de la tolerancia", async () => {
      (propietariosService.obtener as jest.Mock).mockResolvedValue(
        propietario({ id: 1, estatus: "bloqueado", diasToleranciaCobro: 5 }),
      );
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 2, estado: "pendiente", fechaVencimiento: "2026-08-24" }),
      ]);

      const habilitado = await service.habilitarSiSinMorosidad(1, hoy);

      expect(habilitado).toBe(true);
      expect(propietariosService.setEstatus).toHaveBeenCalledWith(1, "activo");
    });

    it("no re-activa si queda otro cobro moroso", async () => {
      (propietariosService.obtener as jest.Mock).mockResolvedValue(
        propietario({ id: 1, estatus: "bloqueado", diasToleranciaCobro: 5 }),
      );
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 2, estado: "vencido", fechaVencimiento: "2026-07-20" }),
      ]);

      const habilitado = await service.habilitarSiSinMorosidad(1, hoy);

      expect(habilitado).toBe(false);
      expect(propietariosService.setEstatus).not.toHaveBeenCalled();
    });

    it("no hace nada si el propietario no está bloqueado", async () => {
      (propietariosService.obtener as jest.Mock).mockResolvedValue(
        propietario({ id: 1, estatus: "activo", diasToleranciaCobro: 5 }),
      );

      const habilitado = await service.habilitarSiSinMorosidad(1, hoy);

      expect(habilitado).toBe(false);
      expect(propietariosService.setEstatus).not.toHaveBeenCalled();
    });
  });
});