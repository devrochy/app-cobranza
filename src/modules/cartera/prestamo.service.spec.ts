import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { RutaConfigDefaults } from "../rutas/ruta-config.service";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { CreatePrestamoInput, PrestamoService } from "./prestamo.service";

describe("PrestamoService", () => {
  let service: PrestamoService;
  let rutaRepo: { findOne: jest.Mock };
  let clienteRepo: { findOne: jest.Mock; save: jest.Mock };
  let configRepo: { findOne: jest.Mock };
  let prestamoRepo: { create: jest.Mock };
  let cuotaRepo: { find: jest.Mock; count: jest.Mock };
  let manager: { save: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: { save: jest.Mock };
  };

  const baseInput: CreatePrestamoInput = {
    clienteId: 1,
    valor: 1000,
    numCuotas: 8,
    diasEntreCuotas: 7,
  };

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };
  // Fecha relativa a hoy (medianoche UTC) para no depender de una fecha absoluta
  // (la validación ±30 días) y para que las diferencias de vencimiento sean exactas.
  const fechaOtorgado = new Date();
  fechaOtorgado.setUTCHours(0, 0, 0, 0);

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

  function configFixture(overrides: Partial<RutaConfig> = {}): RutaConfig {
    return { ...RutaConfigDefaults, ...overrides } as RutaConfig;
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    manager = { save: jest.fn(async (entidad: unknown, filas?: unknown[]) => filas ?? entidad) };
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager,
    };

    rutaRepo = { findOne: jest.fn() };
    clienteRepo = { findOne: jest.fn(), save: jest.fn(async (c: Cliente) => c) };
    configRepo = { findOne: jest.fn() };
    prestamoRepo = { create: jest.fn() };
    cuotaRepo = { find: jest.fn(), count: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrestamoService,
        { provide: getRepositoryToken(Ruta), useValue: rutaRepo },
        { provide: getRepositoryToken(Cliente), useValue: clienteRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: configRepo },
        { provide: getRepositoryToken(Prestamo), useValue: prestamoRepo },
        { provide: getRepositoryToken(Cuota), useValue: cuotaRepo },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn(() => queryRunner) } },
      ],
    }).compile();

    service = module.get(PrestamoService);
  });

  function clienteFixture(overrides: Partial<Cliente> = {}): Cliente {
    return {
      id: 1,
      rutaId: 1,
      nombre: "Juan",
      apellido: "Pérez",
      negocio: null,
      telefonoWhatsapp: "+59171111111",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      estatus: "activo",
      colorRiesgo: "blanco",
      createdAt: new Date(),
      ...overrides,
    } as Cliente;
  }

  function setupFeliz() {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue(
      configFixture({ permitirCambioFechaPrestamo: true }),
    );
    (cuotaRepo.find as jest.Mock).mockResolvedValue([]);
    (cuotaRepo.count as jest.Mock).mockResolvedValue(0);
    prestamoRepo.create.mockImplementation((e: Partial<Prestamo>) => e as Prestamo);
  }

  describe("validaciones", () => {
    it("lanza NotFoundException si la ruta no existe", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.crear(999, baseInput, adminContext, fechaOtorgado)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza NotFoundException si el cliente no existe o es de otra ruta", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.crear(1, baseInput, adminContext, fechaOtorgado)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza BadRequestException si numCuotas es menor que cuotas_minimas_prestamo", async () => {
      setupFeliz();
      (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ cuotasMinimasPrestamo: 10 }));

      await expect(service.crear(1, baseInput, adminContext, fechaOtorgado)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("un socio no puede registrar en una ruta ajena -> 403", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

      await expect(service.crear(1, baseInput, socioContext, fechaOtorgado)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("rechaza con 409 si el préstamo excede el tope de deuda del cliente", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture({ topeMaximoDeuda: 100 }));
      (configRepo.findOne as jest.Mock).mockResolvedValue(
        configFixture({ permitirCambioFechaPrestamo: true }),
      );
      (cuotaRepo.find as jest.Mock).mockResolvedValue([{ valorEsperado: 400 }, { valorEsperado: 400 }]);

      await expect(service.crear(1, baseInput, adminContext, fechaOtorgado)).rejects.toThrow(
        ConflictException,
      );
    });

    it("permite el préstamo si el valor + saldo vigente no excede el tope de deuda del cliente", async () => {
      (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
      (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture({ topeMaximoDeuda: 10000 }));
      (configRepo.findOne as jest.Mock).mockResolvedValue(
        configFixture({ permitirCambioFechaPrestamo: true }),
      );
      (cuotaRepo.find as jest.Mock).mockResolvedValue([]);
      (cuotaRepo.count as jest.Mock).mockResolvedValue(0);
      prestamoRepo.create.mockImplementation((e: Partial<Prestamo>) => e as Prestamo);

      const result = await service.crear(1, baseInput, adminContext, fechaOtorgado);
      expect(result.valor).toBe(1000);
    });

    it("rechaza con 400 si la fecha del préstamo difiere más de 30 días de hoy", async () => {
      setupFeliz();
      const fechaLejana = new Date();
      fechaLejana.setDate(fechaLejana.getDate() + 60);

      await expect(service.crear(1, baseInput, adminContext, fechaLejana)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rechaza con 400 si la fecha difiere de hoy y permitir_cambio_fecha_prestamo es false", async () => {
      setupFeliz();
      (configRepo.findOne as jest.Mock).mockResolvedValue(
        configFixture({ permitirCambioFechaPrestamo: false }),
      );
      const fechaDiferente = new Date();
      fechaDiferente.setDate(fechaDiferente.getDate() + 1);

      await expect(service.crear(1, baseInput, adminContext, fechaDiferente)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("persiste el fiador cuando se envía", async () => {
      setupFeliz();
      const inputConFiador = {
        ...baseInput,
        fiadorNombre: "Ana",
        fiadorApellido: "López",
        fiadorDocumento: "12345",
        fiadorTelefono: "+59170000000",
      };

      await service.crear(1, inputConFiador, adminContext, fechaOtorgado);

      expect(prestamoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fiadorNombre: "Ana",
          fiadorApellido: "López",
          fiadorDocumento: "12345",
          fiadorTelefono: "+59170000000",
        }),
      );
    });
  });

  describe("cupo", () => {
    it("rechaza con 409 si manejo_cupo_activo y valor + saldo vigente exceden el cupo", async () => {
      setupFeliz();
      (configRepo.findOne as jest.Mock).mockResolvedValue(
        configFixture({ manejoCupoActivo: true, cupoDefault: 1200, permitirCambioFechaPrestamo: true }),
      );
      (cuotaRepo.find as jest.Mock).mockResolvedValue([
        { valorEsperado: 500 },
        { valorEsperado: 500 },
      ]);

      await expect(service.crear(1, baseInput, adminContext, fechaOtorgado)).rejects.toThrow(
        ConflictException,
      );
    });

    it("permite el préstamo si valor + saldo vigente están dentro del cupo", async () => {
      setupFeliz();
      (configRepo.findOne as jest.Mock).mockResolvedValue(
        configFixture({ manejoCupoActivo: true, cupoDefault: 1500, permitirCambioFechaPrestamo: true }),
      );
      (cuotaRepo.find as jest.Mock).mockResolvedValue([
        { valorEsperado: 100 },
        { valorEsperado: 100 },
      ]);

      const result = await service.crear(1, baseInput, adminContext, fechaOtorgado);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.valor).toBe(1000);
    });

    it("no aplica cupo si manejo_cupo_activo es false", async () => {
      setupFeliz();
      (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ manejoCupoActivo: false, permitirCambioFechaPrestamo: true }));

      const result = await service.crear(1, { ...baseInput, valor: 999999 }, adminContext, fechaOtorgado);

      expect(result.valor).toBe(999999);
    });
  });

  describe("generación de cuotas", () => {
    it("genera numCuotas cuotas con valores coherentes y vencimientos espaciados", async () => {
      setupFeliz();

      const result = await service.crear(1, baseInput, adminContext, fechaOtorgado);

      expect(result.cuotas).toHaveLength(8);
      const totalEsperado = 1000 * 1.2; // 20% de la ruta
      const suma = result.cuotas.reduce((s: number, c) => s + c.valorEsperado, 0);
      expect(suma).toBeCloseTo(totalEsperado, 2);

      const fechaBase = fechaOtorgado.getTime();
      expect(new Date(result.cuotas[0].fechaVencimiento).getTime() - fechaBase).toBe(7 * 86400000);
      expect(new Date(result.cuotas[7].fechaVencimiento).getTime() - fechaBase).toBe(56 * 86400000);
      expect(result.cuotas[0].numeroCuota).toBe(1);
      expect(result.cuotas[0].estatus).toBe("pendiente");
    });

    it("usa el tipoInteres de la ruta por defecto", async () => {
      setupFeliz();

      const result = await service.crear(1, baseInput, adminContext, fechaOtorgado);

      expect(result.tipoInteres).toBe(20);
    });

    it("atrasa al lunes una cuota cuyo vencimiento cae en domingo (solo_domingos)", async () => {
      setupFeliz();
      // fechaOtorgado = 2026-08-12 (miércoles). Con diasEntreCuotas=4, la cuota 1
      // vence 2026-08-16 (domingo) -> se atrasa a 2026-08-17 (lunes).
      const result = await service.crear(
        1,
        { ...baseInput, diasEntreCuotas: 4 },
        adminContext,
        new Date("2026-08-12T00:00:00Z"),
      );

      expect(result.cuotas[0].fechaVencimiento).toBe("2026-08-17");
    });

    it("no ajusta si la cuota no cae en domingo", async () => {
      setupFeliz();
      // diasEntreCuotas=3: cuota 1 vence 2026-08-15 (sábado) -> sin ajuste.
      const result = await service.crear(
        1,
        { ...baseInput, diasEntreCuotas: 3 },
        adminContext,
        new Date("2026-08-12T00:00:00Z"),
      );

      expect(result.cuotas[0].fechaVencimiento).toBe("2026-08-15");
    });

    it("usa el tipoInteres del préstamo si se especifica (override)", async () => {
      setupFeliz();

      const result = await service.crear(
        1,
        { ...baseInput, tipoInteres: 30 },
        adminContext,
        fechaOtorgado,
      );

      expect(result.tipoInteres).toBe(30);
    });

    it("hace rollback si la persistencia falla", async () => {
      setupFeliz();
      manager.save.mockRejectedValueOnce(new Error("boom"));

      await expect(service.crear(1, baseInput, adminContext, fechaOtorgado)).rejects.toThrow(
        "boom",
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("la última cuota absorbe el redondeo cuando el total no es divisible", async () => {
      setupFeliz();

      const result = await service.crear(
        1,
        { ...baseInput, valor: 100, numCuotas: 7 },
        adminContext,
        fechaOtorgado,
      );

      expect(result.cuotas).toHaveLength(7);
      const suma = result.cuotas.reduce((s: number, c) => s + c.valorEsperado, 0);
      expect(suma).toBeCloseTo(100 * 1.2, 2);
      const primerasIguales = result.cuotas.slice(0, 6).every(
        (c: { valorEsperado: number }) => c.valorEsperado === result.cuotas[0].valorEsperado,
      );
      expect(primerasIguales).toBe(true);
    });
  });

  describe("color de riesgo", () => {
    it("actualiza el color del cliente a azul cuando no hay atraso", async () => {
      setupFeliz();
      const cliente = clienteFixture();
      (clienteRepo.findOne as jest.Mock).mockResolvedValue(cliente);

      await service.crear(1, baseInput, adminContext, fechaOtorgado);

      expect(cliente.colorRiesgo).toBe("azul");
    });

    it("actualiza el color a rojo si hay cuotas atrasadas sobre el umbral", async () => {
      setupFeliz();
      const cliente = clienteFixture({ colorRiesgo: "azul" });
      (clienteRepo.findOne as jest.Mock).mockResolvedValue(cliente);
      (configRepo.findOne as jest.Mock).mockResolvedValue(configFixture({ cuotasAtrasoUmbral: 2, permitirCambioFechaPrestamo: true }));
      (cuotaRepo.count as jest.Mock).mockResolvedValue(3);

      await service.crear(1, baseInput, adminContext, fechaOtorgado);

      expect(cliente.colorRiesgo).toBe("rojo");
    });
  });
});
