import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import {
  RutaConfigDefaults,
  RutaConfigService,
} from "./ruta-config.service";

describe("RutaConfigService", () => {
  let service: RutaConfigService;
  let rutaRepo: Repository<Ruta>;
  let configRepo: Repository<RutaConfig>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };

  function rutaFixture(overrides: Partial<Ruta> = {}): Ruta {
    return {
      id: 1,
      socioId: 1,
      cobradorId: 1,
      nombre: "Ruta Centro",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Ruta;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RutaConfigService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
      ],
    }).compile();

    service = module.get(RutaConfigService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    configRepo = module.get(getRepositoryToken(RutaConfig));
  });

  describe("getMatriz", () => {
    it("materializa los defaults conservadores si no hay fila", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);

      const matriz = await service.getMatriz(1, adminContext);

      expect(matriz).toMatchObject(RutaConfigDefaults);
      expect(matriz.rutaId).toBe(1);
    });

    it("expone diasNoLaborables con default solo_domingos", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);

      const matriz = await service.getMatriz(1, adminContext);

      expect(matriz.diasNoLaborables).toBe("solo_domingos");
    });

    it("devuelve la fila persistida si existe", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue({
        rutaId: 1,
        ...RutaConfigDefaults,
        mostrarCaja: true,
        cupoDefault: 2000,
      } as RutaConfig);

      const matriz = await service.getMatriz(1, adminContext);

      expect(matriz.mostrarCaja).toBe(true);
      expect(matriz.cupoDefault).toBe(2000);
    });

    it("lanza NotFoundException si la ruta no existe", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getMatriz(999, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("un socio no puede consultar la matriz de una ruta ajena -> 403", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

      await expect(service.getMatriz(1, socioContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("setMatriz", () => {
    it("crea la fila desde defaults y aplica los cambios (upsert)", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);
      (configRepo.create as jest.Mock).mockImplementation((e: Partial<RutaConfig>) => ({
        ...RutaConfigDefaults,
        ...e,
      }) as RutaConfig);
      (configRepo.save as jest.Mock).mockImplementation(async (e: Partial<RutaConfig>) => ({
        ...RutaConfigDefaults,
        ...e,
      }) as RutaConfig);

      const matriz = await service.setMatriz(
        1,
        { mostrarCaja: true, cupoDefault: 2000, diasNoLaborables: "domingos_y_feriados" },
        adminContext,
      );

      expect(configRepo.save).toHaveBeenCalled();
      expect(matriz.mostrarCaja).toBe(true);
      expect(matriz.cupoDefault).toBe(2000);
      expect(matriz.diasNoLaborables).toBe("domingos_y_feriados");
      expect(matriz.mostrarPrestamos).toBe(false);
    });

    it("actualiza la fila existente con reemplazo total (ausentes vuelven a default)", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      const existente = { ...RutaConfigDefaults, mostrarCaja: true } as RutaConfig;
      (configRepo.findOne as jest.Mock).mockResolvedValue(existente);
      (configRepo.save as jest.Mock).mockImplementation(async (e: Partial<RutaConfig>) => ({
        ...e,
      }) as RutaConfig);

      const matriz = await service.setMatriz(1, { mostrarPrestamos: true }, adminContext);

      expect(matriz.mostrarPrestamos).toBe(true);
      expect(matriz.mostrarCaja).toBe(false);
    });

    it("body vacío o indefinido resetea a defaults", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);
      (configRepo.create as jest.Mock).mockImplementation((e: Partial<RutaConfig>) => ({
        ...RutaConfigDefaults,
        ...e,
      }) as RutaConfig);
      (configRepo.save as jest.Mock).mockImplementation(async (e: Partial<RutaConfig>) => ({
        ...RutaConfigDefaults,
        ...e,
      }) as RutaConfig);

      const matriz = await service.setMatriz(1, {}, adminContext);

      expect(matriz).toMatchObject(RutaConfigDefaults);
    });

    it("lanza BadRequestException si recibe una clave fuera de la matriz", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());

      await expect(
        service.setMatriz(
          1,
          { mostrarCaja: true, permiso_inventado: true } as Parameters<
            typeof service.setMatriz
          >[1],
          adminContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("un socio no puede configurar la matriz de una ruta ajena -> 403", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

      await expect(
        service.setMatriz(1, { mostrarCaja: true }, socioContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
