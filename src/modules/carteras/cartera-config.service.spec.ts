import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cartera } from "./cartera.entity";
import { CarteraConfig } from "./cartera-config.entity";
import {
  CarteraConfigDefaults,
  CarteraConfigService,
} from "./cartera-config.service";

describe("CarteraConfigService", () => {
  let service: CarteraConfigService;
  let carteraRepo: Repository<Cartera>;
  let configRepo: Repository<CarteraConfig>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };

  function carteraFixture(overrides: Partial<Cartera> = {}): Cartera {
    return {
      id: 1,
      propietarioId: 1,
      gestorId: 1,
      nombre: "Cartera Centro",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Cartera;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarteraConfigService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(CarteraConfig), useValue: mockConfigRepo },
      ],
    }).compile();

    service = module.get(CarteraConfigService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    configRepo = module.get(getRepositoryToken(CarteraConfig));
  });

  describe("getMatriz", () => {
    it("materializa los defaults conservadores si no hay fila", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);

      const matriz = await service.getMatriz(1, adminContext);

      expect(matriz).toMatchObject(CarteraConfigDefaults);
      expect(matriz.carteraId).toBe(1);
    });

    it("expone diasNoLaborables con default solo_domingos", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);

      const matriz = await service.getMatriz(1, adminContext);

      expect(matriz.diasNoLaborables).toBe("solo_domingos");
    });

    it("expone registroDocumentoCliente con default false", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);

      const matriz = await service.getMatriz(1, adminContext);

      expect(matriz.registroDocumentoCliente).toBe(false);
    });

    it("expone rutaHabilitada con default false", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);

      const matriz = await service.getMatriz(1, adminContext);

      expect(matriz.rutaHabilitada).toBe(false);
    });

    it("devuelve la fila persistida si existe", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue({
        carteraId: 1,
        ...CarteraConfigDefaults,
        mostrarCaja: true,
        cupoDefault: 2000,
      } as CarteraConfig);

      const matriz = await service.getMatriz(1, adminContext);

      expect(matriz.mostrarCaja).toBe(true);
      expect(matriz.cupoDefault).toBe(2000);
    });

    it("lanza NotFoundException si la cartera no existe", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getMatriz(999, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("un propietario no puede consultar la matriz de una cartera ajena -> 403", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

      await expect(service.getMatriz(1, propietarioContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("setMatriz", () => {
    it("crea la fila desde defaults y aplica los cambios (upsert)", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);
      (configRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraConfig>) => ({
        ...CarteraConfigDefaults,
        ...e,
      }) as CarteraConfig);
      (configRepo.save as jest.Mock).mockImplementation(async (e: Partial<CarteraConfig>) => ({
        ...CarteraConfigDefaults,
        ...e,
      }) as CarteraConfig);

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
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      const existente = { ...CarteraConfigDefaults, mostrarCaja: true } as CarteraConfig;
      (configRepo.findOne as jest.Mock).mockResolvedValue(existente);
      (configRepo.save as jest.Mock).mockImplementation(async (e: Partial<CarteraConfig>) => ({
        ...e,
      }) as CarteraConfig);

      const matriz = await service.setMatriz(1, { mostrarPrestamos: true }, adminContext);

      expect(matriz.mostrarPrestamos).toBe(true);
      expect(matriz.mostrarCaja).toBe(false);
    });

    it("body vacío o indefinido resetea a defaults", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);
      (configRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraConfig>) => ({
        ...CarteraConfigDefaults,
        ...e,
      }) as CarteraConfig);
      (configRepo.save as jest.Mock).mockImplementation(async (e: Partial<CarteraConfig>) => ({
        ...CarteraConfigDefaults,
        ...e,
      }) as CarteraConfig);

      const matriz = await service.setMatriz(1, {}, adminContext);

      expect(matriz).toMatchObject(CarteraConfigDefaults);
    });

    it("persiste rutaHabilitada cuando se habilita la ruta de la cartera", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
      (configRepo.findOne as jest.Mock).mockResolvedValue(null);
      (configRepo.create as jest.Mock).mockImplementation((e: Partial<CarteraConfig>) => ({
        ...CarteraConfigDefaults,
        ...e,
      }) as CarteraConfig);
      (configRepo.save as jest.Mock).mockImplementation(async (e: Partial<CarteraConfig>) => ({
        ...CarteraConfigDefaults,
        ...e,
      }) as CarteraConfig);

      const matriz = await service.setMatriz(1, { rutaHabilitada: true }, adminContext);

      expect(matriz.rutaHabilitada).toBe(true);
    });

    it("lanza BadRequestException si recibe una clave fuera de la matriz", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());

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

    it("un propietario no puede configurar la matriz de una cartera ajena -> 403", async () => {
      (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

      await expect(
        service.setMatriz(1, { mostrarCaja: true }, propietarioContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
