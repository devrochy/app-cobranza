import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { Cartera } from "./cartera.entity";
import { CreateCarteraInput, RequesterContext, CarterasService } from "./carteras.service";
import { CajaService } from "./caja.service";

describe("CarterasService", () => {
  let service: CarterasService;
  let carteraRepo: Repository<Cartera>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;

  const baseInput: CreateCarteraInput = {
    nombre: "Cartera Centro",
    descripcion: "Zona céntrica",
    propietarioId: 1,
    gestorId: 1,
    tipoInteres: 20,
    numCuotas: 8,
    moneda: "BOB",
    saldoInicial: 1000,
    costoCobro: 250,
  };

  const adminContext: RequesterContext = { rol: "admin", sub: 0 };
  const propietarioContext: RequesterContext = { rol: "propietario", sub: 1 };

  const mockCarteraRepo = {
    findOne: jest.fn(),
    create: jest.fn((entity: Partial<Cartera>) => entity as Cartera),
    save: jest.fn(async (entity: Partial<Cartera>) => entity as Cartera),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockPropietarioRepo = { findOne: jest.fn() };
  const mockGestorRepo = { findOne: jest.fn() };
  const mockCajaService = {
    crearCaja: jest.fn(async (carteraId: number, saldoInicial: number) => ({
      carteraId,
      saldoInicial,
      saldoActual: saldoInicial,
    })),
  };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
      const manager = {
        save: mockCarteraRepo.save,
        getRepository: jest.fn(() => ({ create: jest.fn(), save: jest.fn() })),
      };
      return fn(manager);
    }),
  };

  function propietarioFixture(overrides: Partial<Propietario> = {}): Propietario {
    return { id: 1, usuario: "propietario1", estatus: "activo", ...overrides } as Propietario;
  }

  function gestorFixture(overrides: Partial<Gestor> = {}): Gestor {
    return {
      id: 1,
      propietarioId: 1,
      usuario: "gestor1",
      estatus: "activo",
      ...overrides,
    } as Gestor;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarterasService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(Propietario), useValue: mockPropietarioRepo },
        { provide: getRepositoryToken(Gestor), useValue: mockGestorRepo },
        { provide: CajaService, useValue: mockCajaService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(CarterasService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    propietarioRepo = module.get(getRepositoryToken(Propietario));
    gestorRepo = module.get(getRepositoryToken(Gestor));
  });

  describe("create", () => {
    it("persiste la cartera y devuelve su representación pública", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());
      (carteraRepo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, estatus: "activo", createdAt: new Date() });

      const result = await service.create(baseInput, adminContext);

      expect(carteraRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ id: 1, nombre: "Cartera Centro", tipoInteres: 20, numCuotas: 8, moneda: "BOB", propietarioId: 1, gestorId: 1, costoCobro: 250 });
    });

    it("crea la caja de la cartera con el saldo inicial al registrar la cartera", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());
      (carteraRepo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, estatus: "activo", createdAt: new Date() });

      await service.create(baseInput, adminContext);

      expect(mockCajaService.crearCaja).toHaveBeenCalledWith(
        1,
        1000,
        expect.anything(),
      );
    });

    it("lanza NotFoundException si el propietario no existe", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(baseInput, adminContext)).rejects.toThrow(NotFoundException);
    });

    it("lanza NotFoundException si el gestor no existe", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(baseInput, adminContext)).rejects.toThrow(NotFoundException);
    });

    it("lanza ConflictException si el propietario está bloqueado", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture({ estatus: "bloqueado" }));
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());

      await expect(service.create(baseInput, adminContext)).rejects.toThrow(ConflictException);
    });

    it("lanza ConflictException si el gestor está bloqueado", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture({ estatus: "bloqueado" }));

      await expect(service.create(baseInput, adminContext)).rejects.toThrow(ConflictException);
    });

    it("un propietario no puede registrar carteras de otro propietario -> 403", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());

      await expect(service.create(baseInput, { rol: "propietario", sub: 99 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("un propietario no puede asignar un gestor de otro propietario -> 403", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture({ propietarioId: 2 }));

      await expect(service.create(baseInput, propietarioContext)).rejects.toThrow(ForbiddenException);
    });

    it("un propietario puede registrar una cartera con su propio propietario y gestor", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());
      (carteraRepo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, estatus: "activo", createdAt: new Date() });

      const result = await service.create(baseInput, propietarioContext);

      expect(result.propietarioId).toBe(1);
    });
  });

  describe("setEstatus", () => {
    function carteraActual(overrides: Partial<Cartera> = {}): Cartera {
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

    it("reactiva manualmente una cartera", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual({ estatus: "bloqueado" }));
      (mockCarteraRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cartera>) => ({
        ...carteraActual(),
        ...e,
      }));

      const result = await service.setEstatus(1, "activo", adminContext);

      expect(result.estatus).toBe("activo");
    });

    it("lanza NotFoundException si la cartera no existe", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.setEstatus(999, "activo", adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("un propietario no puede cambiar el estatus de una cartera ajena -> 403", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual({ propietarioId: 2 }));

      await expect(service.setEstatus(1, "activo", propietarioContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("reasignarGestor", () => {
    function carteraActual(overrides: Partial<Cartera> = {}): Cartera {
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

    it("reasigna la cartera a otro gestor del mismo propietario y la deja activa", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockGestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture({ id: 2 }));
      (mockCarteraRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cartera>) => ({
        ...carteraActual(),
        ...e,
      }));

      const result = await service.reasignarGestor(1, 2, adminContext);

      expect(result.gestorId).toBe(2);
      expect(result.estatus).toBe("activo");
    });

    it("lanza NotFoundException si la cartera no existe", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.reasignarGestor(999, 2, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza NotFoundException si el gestor no existe", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockGestorRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.reasignarGestor(1, 999, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza ConflictException si el gestor no pertenece al propietario de la cartera", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockGestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture({ id: 2, propietarioId: 7 }));

      await expect(service.reasignarGestor(1, 2, adminContext)).rejects.toThrow(
        ConflictException,
      );
    });

    it("lanza ConflictException si el gestor está bloqueado", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockGestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture({ id: 2, estatus: "bloqueado" }));

      await expect(service.reasignarGestor(1, 2, adminContext)).rejects.toThrow(
        ConflictException,
      );
    });

    it("un propietario no puede reasignar una cartera ajena -> 403", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual({ propietarioId: 2 }));
      (mockGestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture({ id: 2, propietarioId: 2 }));

      await expect(service.reasignarGestor(1, 2, propietarioContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("actualizarInformacion", () => {
    function carteraActual(overrides: Partial<Cartera> = {}): Cartera {
      return {
        id: 1,
        propietarioId: 1,
        gestorId: 1,
        nombre: "Cartera Centro",
        descripcion: "Zona céntrica",
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        estatus: "activo",
        createdAt: new Date(),
        ...overrides,
      } as Cartera;
    }

    it("renombra la cartera y edita la descripción sin alterar la configuración", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockCarteraRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cartera>) => ({
        ...carteraActual(),
        ...e,
      }));

      const result = await service.actualizarInformacion(
        1,
        { nombre: "Cartera Norte", descripcion: "Nueva zona" },
        adminContext,
      );

      expect(result.nombre).toBe("Cartera Norte");
      expect(result.descripcion).toBe("Nueva zona");
      expect(result.gestorId).toBe(1);
      expect(result.tipoInteres).toBe(20);
      expect(result.numCuotas).toBe(8);
      expect(result.moneda).toBe("BOB");
      expect(result.estatus).toBe("activo");
    });

    it("actualiza la descripción junto al nombre", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockCarteraRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cartera>) => ({
        ...carteraActual(),
        ...e,
      }));

      const result = await service.actualizarInformacion(
        1,
        { nombre: "Cartera Centro", descripcion: "Solo descripción" },
        adminContext,
      );

      expect(result.descripcion).toBe("Solo descripción");
      expect(result.nombre).toBe("Cartera Centro");
    });

    it("limpia la descripción cuando se envía null", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockCarteraRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cartera>) => ({
        ...carteraActual(),
        ...e,
      }));

      const result = await service.actualizarInformacion(
        1,
        { nombre: "Cartera Centro", descripcion: null },
        adminContext,
      );

      expect(result.descripcion).toBeNull();
    });

    it("lanza NotFoundException si la cartera no existe", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.actualizarInformacion(999, { nombre: "X" }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("un propietario no puede editar la información de una cartera ajena -> 403", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual({ propietarioId: 2 }));

      await expect(
        service.actualizarInformacion(1, { nombre: "X" }, propietarioContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("actualizarConfiguracion", () => {
    function carteraActual(overrides: Partial<Cartera> = {}): Cartera {
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

    it("actualiza el tipo de interés y las cuotas sin tocar el resto", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockCarteraRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cartera>) => ({
        ...carteraActual(),
        ...e,
      }));

      const result = await service.actualizarConfiguracion(
        1,
        { tipoInteres: 25, numCuotas: 10 },
        adminContext,
      );

      expect(result.tipoInteres).toBe(25);
      expect(result.numCuotas).toBe(10);
      expect(result.nombre).toBe("Cartera Centro");
      expect(result.moneda).toBe("BOB");
      expect(result.estatus).toBe("activo");
    });

    it("actualiza solo un campo si el otro no se envía", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());
      (mockCarteraRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cartera>) => ({
        ...carteraActual(),
        ...e,
      }));

      const result = await service.actualizarConfiguracion(
        1,
        { tipoInteres: 30 },
        adminContext,
      );

      expect(result.tipoInteres).toBe(30);
      expect(result.numCuotas).toBe(8);
    });

    it("lanza BadRequestException si no llega ningún campo", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual());

      await expect(
        service.actualizarConfiguracion(1, {}, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it("lanza NotFoundException si la cartera no existe", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.actualizarConfiguracion(999, { tipoInteres: 25 }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("un propietario no puede editar la configuración de una cartera ajena -> 403", async () => {
      (mockCarteraRepo.findOne as jest.Mock).mockResolvedValue(carteraActual({ propietarioId: 2 }));

      await expect(
        service.actualizarConfiguracion(1, { tipoInteres: 25 }, propietarioContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });


  describe("listar", () => {
    const cartera1: Cartera = {
      id: 1,
      nombre: "Cartera Centro",
      descripcion: "Zona céntrica",
      propietarioId: 1,
      gestorId: 1,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      costoCobro: 250,
      estatus: "activo",
      createdAt: new Date(),
    } as Cartera;
    const cartera2: Cartera = {
      ...cartera1,
      id: 2,
      nombre: "Cartera Norte",
      descripcion: null,
      estatus: "bloqueado",
    };

    function mockQueryBuilder(rows: Cartera[]) {
      return {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("lista todas las carteras sin filtros en orden id ASC", async () => {
      const qb = mockQueryBuilder([cartera1, cartera2]);
      (carteraRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const res = await service.listar({});

      expect(carteraRepo.createQueryBuilder).toHaveBeenCalledWith("cartera");
      expect(qb.orderBy).toHaveBeenCalledWith("cartera.id", "ASC");
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(res.map((r) => r.nombre)).toEqual(["Cartera Centro", "Cartera Norte"]);
    });

    it("filtra por busqueda con ILIKE sobre nombre y descripcion", async () => {
      const qb = mockQueryBuilder([cartera1]);
      (carteraRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ busqueda: "  centro  " });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE"),
        { termino: "%centro%" },
      );
    });

    it("filtra por estatus", async () => {
      const qb = mockQueryBuilder([cartera2]);
      (carteraRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ estatus: "bloqueado" });

      expect(qb.andWhere).toHaveBeenCalledWith("cartera.estatus = :estatus", {
        estatus: "bloqueado",
      });
    });

    it("aplica busqueda y estatus juntos", async () => {
      const qb = mockQueryBuilder([]);
      (carteraRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ busqueda: "centro", estatus: "activo" });

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it("ignora una busqueda vacía o de solo espacios", async () => {
      const qb = mockQueryBuilder([cartera1]);
      (carteraRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({ busqueda: "   " });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it("un propietario solo ve sus carteras (ownership)", async () => {
      const qb = mockQueryBuilder([cartera1]);
      (carteraRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.listar({}, { rol: "propietario", sub: 7 });

      expect(qb.andWhere).toHaveBeenCalledWith("cartera.propietario_id = :propietarioId", {
        propietarioId: 7,
      });
    });
  });
});
