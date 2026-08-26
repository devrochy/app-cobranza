import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";
import { Ruta } from "./ruta.entity";
import { CreateRutaInput, RequesterContext, RutasService } from "./rutas.service";
import { CajaService } from "./caja.service";

describe("RutasService", () => {
  let service: RutasService;
  let rutaRepo: Repository<Ruta>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;

  const baseInput: CreateRutaInput = {
    nombre: "Ruta Centro",
    descripcion: "Zona céntrica",
    socioId: 1,
    cobradorId: 1,
    tipoInteres: 20,
    numCuotas: 8,
    moneda: "BOB",
    saldoInicial: 1000,
    costoCobro: 250,
  };

  const adminContext: RequesterContext = { rol: "admin", sub: 0 };
  const socioContext: RequesterContext = { rol: "socio", sub: 1 };

  const mockRutaRepo = {
    findOne: jest.fn(),
    create: jest.fn((entity: Partial<Ruta>) => entity as Ruta),
    save: jest.fn(async (entity: Partial<Ruta>) => entity as Ruta),
    update: jest.fn(),
  };
  const mockSocioRepo = { findOne: jest.fn() };
  const mockCobradorRepo = { findOne: jest.fn() };
  const mockCajaService = {
    crearCaja: jest.fn(async (rutaId: number, saldoInicial: number) => ({
      rutaId,
      saldoInicial,
      saldoActual: saldoInicial,
    })),
  };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
      const manager = {
        save: mockRutaRepo.save,
        getRepository: jest.fn(() => ({ create: jest.fn(), save: jest.fn() })),
      };
      return fn(manager);
    }),
  };

  function socioFixture(overrides: Partial<Socio> = {}): Socio {
    return { id: 1, usuario: "socio1", estatus: "activo", ...overrides } as Socio;
  }

  function cobradorFixture(overrides: Partial<Cobrador> = {}): Cobrador {
    return {
      id: 1,
      socioId: 1,
      usuario: "cobrador1",
      estatus: "activo",
      ...overrides,
    } as Cobrador;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RutasService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Socio), useValue: mockSocioRepo },
        { provide: getRepositoryToken(Cobrador), useValue: mockCobradorRepo },
        { provide: CajaService, useValue: mockCajaService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(RutasService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    socioRepo = module.get(getRepositoryToken(Socio));
    cobradorRepo = module.get(getRepositoryToken(Cobrador));
  });

  describe("create", () => {
    it("persiste la ruta y devuelve su representación pública", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture());
      (rutaRepo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, estatus: "activo", createdAt: new Date() });

      const result = await service.create(baseInput, adminContext);

      expect(rutaRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ id: 1, nombre: "Ruta Centro", tipoInteres: 20, numCuotas: 8, moneda: "BOB", socioId: 1, cobradorId: 1, costoCobro: 250 });
    });

    it("crea la caja de la ruta con el saldo inicial al registrar la ruta", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture());
      (rutaRepo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, estatus: "activo", createdAt: new Date() });

      await service.create(baseInput, adminContext);

      expect(mockCajaService.crearCaja).toHaveBeenCalledWith(
        1,
        1000,
        expect.anything(),
      );
    });

    it("lanza NotFoundException si el socio no existe", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(baseInput, adminContext)).rejects.toThrow(NotFoundException);
    });

    it("lanza NotFoundException si el cobrador no existe", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(baseInput, adminContext)).rejects.toThrow(NotFoundException);
    });

    it("lanza ConflictException si el socio está bloqueado", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture({ estatus: "bloqueado" }));
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture());

      await expect(service.create(baseInput, adminContext)).rejects.toThrow(ConflictException);
    });

    it("lanza ConflictException si el cobrador está bloqueado", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture({ estatus: "bloqueado" }));

      await expect(service.create(baseInput, adminContext)).rejects.toThrow(ConflictException);
    });

    it("un socio no puede registrar rutas de otro socio -> 403", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture());

      await expect(service.create(baseInput, { rol: "socio", sub: 99 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("un socio no puede asignar un cobrador de otro socio -> 403", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture({ socioId: 2 }));

      await expect(service.create(baseInput, socioContext)).rejects.toThrow(ForbiddenException);
    });

    it("un socio puede registrar una ruta con su propio socio y cobrador", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      (cobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture());
      (rutaRepo.save as jest.Mock).mockResolvedValue({ id: 1, ...baseInput, estatus: "activo", createdAt: new Date() });

      const result = await service.create(baseInput, socioContext);

      expect(result.socioId).toBe(1);
    });
  });

  describe("aplicarCascada", () => {
    it("bloquea las rutas del cobrador cuando se bloquea", async () => {
      await service.aplicarCascada(5, true);

      expect(mockRutaRepo.update).toHaveBeenCalledWith(
        { cobrador: { id: 5 } },
        { estatus: "bloqueado" },
      );
    });

    it("reactiva las rutas del cobrador cuando se reactiva", async () => {
      await service.aplicarCascada(5, false);

      expect(mockRutaRepo.update).toHaveBeenCalledWith(
        { cobrador: { id: 5 } },
        { estatus: "activo" },
      );
    });
  });

  describe("setEstatus", () => {
    function rutaActual(overrides: Partial<Ruta> = {}): Ruta {
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

    it("reactiva manualmente una ruta", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual({ estatus: "bloqueado" }));
      (mockRutaRepo.save as jest.Mock).mockImplementation(async (e: Partial<Ruta>) => ({
        ...rutaActual(),
        ...e,
      }));

      const result = await service.setEstatus(1, "activo", adminContext);

      expect(result.estatus).toBe("activo");
    });

    it("lanza NotFoundException si la ruta no existe", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.setEstatus(999, "activo", adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("un socio no puede cambiar el estatus de una ruta ajena -> 403", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual({ socioId: 2 }));

      await expect(service.setEstatus(1, "activo", socioContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("reasignarCobrador", () => {
    function rutaActual(overrides: Partial<Ruta> = {}): Ruta {
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

    it("reasigna la ruta a otro cobrador del mismo socio y la deja activa", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockCobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture({ id: 2 }));
      (mockRutaRepo.save as jest.Mock).mockImplementation(async (e: Partial<Ruta>) => ({
        ...rutaActual(),
        ...e,
      }));

      const result = await service.reasignarCobrador(1, 2, adminContext);

      expect(result.cobradorId).toBe(2);
      expect(result.estatus).toBe("activo");
    });

    it("lanza NotFoundException si la ruta no existe", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.reasignarCobrador(999, 2, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza NotFoundException si el cobrador no existe", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockCobradorRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.reasignarCobrador(1, 999, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza ConflictException si el cobrador no pertenece al socio de la ruta", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockCobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture({ id: 2, socioId: 7 }));

      await expect(service.reasignarCobrador(1, 2, adminContext)).rejects.toThrow(
        ConflictException,
      );
    });

    it("lanza ConflictException si el cobrador está bloqueado", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockCobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture({ id: 2, estatus: "bloqueado" }));

      await expect(service.reasignarCobrador(1, 2, adminContext)).rejects.toThrow(
        ConflictException,
      );
    });

    it("un socio no puede reasignar una ruta ajena -> 403", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual({ socioId: 2 }));
      (mockCobradorRepo.findOne as jest.Mock).mockResolvedValue(cobradorFixture({ id: 2, socioId: 2 }));

      await expect(service.reasignarCobrador(1, 2, socioContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("actualizarInformacion", () => {
    function rutaActual(overrides: Partial<Ruta> = {}): Ruta {
      return {
        id: 1,
        socioId: 1,
        cobradorId: 1,
        nombre: "Ruta Centro",
        descripcion: "Zona céntrica",
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        estatus: "activo",
        createdAt: new Date(),
        ...overrides,
      } as Ruta;
    }

    it("renombra la ruta y edita la descripción sin alterar la configuración", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockRutaRepo.save as jest.Mock).mockImplementation(async (e: Partial<Ruta>) => ({
        ...rutaActual(),
        ...e,
      }));

      const result = await service.actualizarInformacion(
        1,
        { nombre: "Ruta Norte", descripcion: "Nueva zona" },
        adminContext,
      );

      expect(result.nombre).toBe("Ruta Norte");
      expect(result.descripcion).toBe("Nueva zona");
      expect(result.cobradorId).toBe(1);
      expect(result.tipoInteres).toBe(20);
      expect(result.numCuotas).toBe(8);
      expect(result.moneda).toBe("BOB");
      expect(result.estatus).toBe("activo");
    });

    it("actualiza la descripción junto al nombre", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockRutaRepo.save as jest.Mock).mockImplementation(async (e: Partial<Ruta>) => ({
        ...rutaActual(),
        ...e,
      }));

      const result = await service.actualizarInformacion(
        1,
        { nombre: "Ruta Centro", descripcion: "Solo descripción" },
        adminContext,
      );

      expect(result.descripcion).toBe("Solo descripción");
      expect(result.nombre).toBe("Ruta Centro");
    });

    it("limpia la descripción cuando se envía null", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockRutaRepo.save as jest.Mock).mockImplementation(async (e: Partial<Ruta>) => ({
        ...rutaActual(),
        ...e,
      }));

      const result = await service.actualizarInformacion(
        1,
        { nombre: "Ruta Centro", descripcion: null },
        adminContext,
      );

      expect(result.descripcion).toBeNull();
    });

    it("lanza NotFoundException si la ruta no existe", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.actualizarInformacion(999, { nombre: "X" }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("un socio no puede editar la información de una ruta ajena -> 403", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual({ socioId: 2 }));

      await expect(
        service.actualizarInformacion(1, { nombre: "X" }, socioContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("actualizarConfiguracion", () => {
    function rutaActual(overrides: Partial<Ruta> = {}): Ruta {
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

    it("actualiza el tipo de interés y las cuotas sin tocar el resto", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockRutaRepo.save as jest.Mock).mockImplementation(async (e: Partial<Ruta>) => ({
        ...rutaActual(),
        ...e,
      }));

      const result = await service.actualizarConfiguracion(
        1,
        { tipoInteres: 25, numCuotas: 10 },
        adminContext,
      );

      expect(result.tipoInteres).toBe(25);
      expect(result.numCuotas).toBe(10);
      expect(result.nombre).toBe("Ruta Centro");
      expect(result.moneda).toBe("BOB");
      expect(result.estatus).toBe("activo");
    });

    it("actualiza solo un campo si el otro no se envía", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());
      (mockRutaRepo.save as jest.Mock).mockImplementation(async (e: Partial<Ruta>) => ({
        ...rutaActual(),
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
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual());

      await expect(
        service.actualizarConfiguracion(1, {}, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it("lanza NotFoundException si la ruta no existe", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.actualizarConfiguracion(999, { tipoInteres: 25 }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("un socio no puede editar la configuración de una ruta ajena -> 403", async () => {
      (mockRutaRepo.findOne as jest.Mock).mockResolvedValue(rutaActual({ socioId: 2 }));

      await expect(
        service.actualizarConfiguracion(1, { tipoInteres: 25 }, socioContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
