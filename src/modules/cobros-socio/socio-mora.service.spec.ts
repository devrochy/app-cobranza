import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SociosService } from "../socios/socios.service";
import { CobroSocio } from "./cobro-socio.entity";
import { SocioMoraService } from "./socio-mora.service";

describe("SocioMoraService", () => {
  let service: SocioMoraService;
  let cobroRepo: Repository<CobroSocio>;
  let sociosService: SociosService;

  const hoy = new Date("2026-08-26T00:00:00Z");

  const socio = (overrides: Partial<{ id: number; estatus: string; diasToleranciaCobro: number }> = {}) =>
    ({
      id: 1,
      estatus: "activo",
      diasToleranciaCobro: 5,
      ...overrides,
    }) as never;

  const cobro = (overrides: Partial<CobroSocio> = {}) =>
    ({
      id: 1,
      socioId: 1,
      periodo: "2026-08",
      fechaVencimiento: "2026-08-15",
      estado: "pendiente",
      socio: socio(),
      ...overrides,
    }) as CobroSocio;

  const mockCobroRepo = { find: jest.fn() };
  const mockSociosService = {
    obtener: jest.fn(),
    setEstatus: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocioMoraService,
        { provide: getRepositoryToken(CobroSocio), useValue: mockCobroRepo },
        { provide: SociosService, useValue: mockSociosService },
      ],
    }).compile();

    service = module.get(SocioMoraService);
    cobroRepo = module.get(getRepositoryToken(CobroSocio));
    sociosService = module.get(SociosService);
  });

  describe("bloquearMorosos", () => {
    it("consulta cobros no pagados con su socio", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([]);
      await service.bloquearMorosos(hoy);
      expect(cobroRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { socio: true } }),
      );
    });

    it("bloquea un socio activo con un cobro vencido más allá de la tolerancia", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([cobro()]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(1);
      expect(sociosService.setEstatus).toHaveBeenCalledWith(1, "bloqueado");
    });

    it("no bloquea si el cobro está dentro de la tolerancia", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ fechaVencimiento: "2026-08-24" }),
      ]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(0);
      expect(sociosService.setEstatus).not.toHaveBeenCalled();
    });

    it("no bloquea un socio ya bloqueado aunque tenga morosidad", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ socio: socio({ estatus: "bloqueado" }) }),
      ]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(0);
      expect(sociosService.setEstatus).not.toHaveBeenCalled();
    });

    it("ignora cobros pagados viejos", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ estado: "pagado", fechaVencimiento: "2026-07-15" }),
      ]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(0);
      expect(sociosService.setEstatus).not.toHaveBeenCalled();
    });

    it("bloquea una sola vez por socio aunque tenga varios cobros morosos", async () => {
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 1 }),
        cobro({ id: 2, periodo: "2026-07", fechaVencimiento: "2026-07-15" }),
      ]);

      const bloqueados = await service.bloquearMorosos(hoy);

      expect(bloqueados).toBe(1);
      expect(sociosService.setEstatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("habilitarSiSinMorosidad", () => {
    it("re-activa un socio bloqueado si ya no queda ningún cobro moroso", async () => {
      (sociosService.obtener as jest.Mock).mockResolvedValue(
        socio({ id: 1, estatus: "bloqueado", diasToleranciaCobro: 5 }),
      );
      (cobroRepo.find as jest.Mock).mockResolvedValue([]);

      const habilitado = await service.habilitarSiSinMorosidad(1, hoy);

      expect(habilitado).toBe(true);
      expect(sociosService.setEstatus).toHaveBeenCalledWith(1, "activo");
    });

    it("re-activa si el único cobro restante está dentro de la tolerancia", async () => {
      (sociosService.obtener as jest.Mock).mockResolvedValue(
        socio({ id: 1, estatus: "bloqueado", diasToleranciaCobro: 5 }),
      );
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 2, estado: "pendiente", fechaVencimiento: "2026-08-24" }),
      ]);

      const habilitado = await service.habilitarSiSinMorosidad(1, hoy);

      expect(habilitado).toBe(true);
      expect(sociosService.setEstatus).toHaveBeenCalledWith(1, "activo");
    });

    it("no re-activa si queda otro cobro moroso", async () => {
      (sociosService.obtener as jest.Mock).mockResolvedValue(
        socio({ id: 1, estatus: "bloqueado", diasToleranciaCobro: 5 }),
      );
      (cobroRepo.find as jest.Mock).mockResolvedValue([
        cobro({ id: 2, estado: "vencido", fechaVencimiento: "2026-07-20" }),
      ]);

      const habilitado = await service.habilitarSiSinMorosidad(1, hoy);

      expect(habilitado).toBe(false);
      expect(sociosService.setEstatus).not.toHaveBeenCalled();
    });

    it("no hace nada si el socio no está bloqueado", async () => {
      (sociosService.obtener as jest.Mock).mockResolvedValue(
        socio({ id: 1, estatus: "activo", diasToleranciaCobro: 5 }),
      );

      const habilitado = await service.habilitarSiSinMorosidad(1, hoy);

      expect(habilitado).toBe(false);
      expect(sociosService.setEstatus).not.toHaveBeenCalled();
    });
  });
});