import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { Cliente } from "./cliente.entity";
import { ClienteEvidencia } from "./cliente-evidencia.entity";
import { ClienteTarjetaService } from "./cliente-tarjeta.service";

describe("ClienteTarjetaService", () => {
  let service: ClienteTarjetaService;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockClienteRepo = { findOne: jest.fn() };
  const mockEvidenciaRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockDataSource = { transaction: jest.fn() };

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

  function clienteFixture(overrides: Partial<Cliente> = {}): Cliente {
    return {
      id: 10,
      carteraId: 1,
      nombre: "Juan",
      apellido: "Perez",
      negocio: "Tienda",
      telefonoWhatsapp: "+59171160000",
      ubicacion: { type: "Point", coordinates: [-63.1, -17.7] },
      ubicacionDomicilio: null,
      topeMaximoDeuda: null,
      estatus: "activo",
      colorRiesgo: "azul",
      tipoDocumento: "ci",
      numeroDocumento: "1234567",
      createdAt: new Date(),
      ...overrides,
    } as Cliente;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClienteTarjetaService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(ClienteEvidencia), useValue: mockEvidenciaRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(ClienteTarjetaService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    clienteRepo = module.get(getRepositoryToken(Cliente));
  });

  it("lanza NotFoundException si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(999, 10, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede ver la tarjeta de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(service.obtener(1, 10, propietarioContext)).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si el cliente no existe en la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("construye la tarjeta con foto, tipo de pago, saldo y días de mora", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.find as jest.Mock).mockResolvedValue([
      { tipo: "foto_facial", carteraArchivo: "/uploads/foto.jpg" } as ClienteEvidencia,
    ]);
    // préstamos con periodicidad semanal; saldo 1000; cuota vencida hace 5 días.
    (service as unknown as { obtenerPrestamosVigentes: jest.Mock }).obtenerPrestamosVigentes = jest
      .fn()
      .mockResolvedValue([{ diasEntreCuotas: 7 }, { diasEntreCuotas: 7 }]);
    (service as unknown as { obtenerSaldoYMorosidad: jest.Mock }).obtenerSaldoYMorosidad = jest
      .fn()
      .mockResolvedValue({ saldoPendiente: 1000, fechaVencidaMasAntigua: "2026-08-14" });

    const result = await service.obtener(1, 10, adminContext);

    expect(result.nombre).toBe("Juan Perez");
    expect(result.negocio).toBe("Tienda");
    expect(result.telefonoWhatsapp).toBe("+59171160000");
    expect(result.fotoUrl).toBe("/uploads/foto.jpg");
    expect(result.documentoFrenteUrl).toBeNull();
    expect(result.documentoReversoUrl).toBeNull();
    expect(result.tipoDocumento).toBe("ci");
    expect(result.numeroDocumento).toBe("1234567");
    expect(result.latitud).toBe(-17.7);
    expect(result.longitud).toBe(-63.1);
    expect(result.latitudDomicilio).toBeNull();
    expect(result.tipoPago).toBe("semanal");
    expect(result.saldoPendiente).toBe(1000);
    expect(result.diasMora).toBeGreaterThan(0);
  });

  it("marca tipoPago Varios si los préstamos difieren en periodicidad", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.find as jest.Mock).mockResolvedValue([]);
    (service as unknown as { obtenerPrestamosVigentes: jest.Mock }).obtenerPrestamosVigentes = jest
      .fn()
      .mockResolvedValue([{ diasEntreCuotas: 7 }, { diasEntreCuotas: 30 }]);
    (service as unknown as { obtenerSaldoYMorosidad: jest.Mock }).obtenerSaldoYMorosidad = jest
      .fn()
      .mockResolvedValue({ saldoPendiente: 0, fechaVencidaMasAntigua: null });

    const result = await service.obtener(1, 10, adminContext);

    expect(result.tipoPago).toBe("Varios");
    expect(result.fotoUrl).toBeNull();
  });

  it("normaliza a URL servible los carteraArchivo absolutos del filesystem", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.find as jest.Mock).mockResolvedValue([
      {
        tipo: "foto_facial",
        carteraArchivo: "/Users/roaguilar/Projects/app-cobranza/uploads/clientes/foto.jpg",
      } as ClienteEvidencia,
      {
        tipo: "documento_frente",
        carteraArchivo: "/uploads/gastos/inexistente.jpg",
      } as ClienteEvidencia,
      {
        tipo: "documento_reverso",
        carteraArchivo: "/uploads/clientes/reverso.jpg",
      } as ClienteEvidencia,
    ]);
    (service as unknown as { obtenerPrestamosVigentes: jest.Mock }).obtenerPrestamosVigentes = jest
      .fn()
      .mockResolvedValue([]);
    (service as unknown as { obtenerSaldoYMorosidad: jest.Mock }).obtenerSaldoYMorosidad = jest
      .fn()
      .mockResolvedValue({ saldoPendiente: 0, fechaVencidaMasAntigua: null });

    const result = await service.obtener(1, 10, adminContext);

    expect(result.fotoUrl).toBe("/uploads/clientes/foto.jpg");
    // Una URL que ya es servible (/uploads/...) no se altera.
    expect(result.documentoFrenteUrl).toBe("/uploads/gastos/inexistente.jpg");
    expect(result.documentoReversoUrl).toBe("/uploads/clientes/reverso.jpg");
  });

  it("descargarEvidencia devuelve los datos del archivo por tipo", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.findOne as jest.Mock).mockResolvedValue({
      tipo: "foto_facial",
      carteraArchivo: "/uploads/clientes/foto.jpg",
      nombreOriginal: "foto.jpg",
      mimetype: "image/jpeg",
    } as ClienteEvidencia);

    const result = await service.descargarEvidencia(1, 10, "foto_facial", adminContext);

    expect(result).toEqual({
      carteraArchivo: "/uploads/clientes/foto.jpg",
      mimetype: "image/jpeg",
      nombreOriginal: "foto.jpg",
    });
    expect(mockEvidenciaRepo.findOne).toHaveBeenCalledWith({
      where: { cliente: { id: 10 }, tipo: "foto_facial" },
    });
  });

  it("descargarEvidencia rechaza un tipo desconocido -> 404", async () => {
    await expect(
      service.descargarEvidencia(1, 10, "otro", adminContext),
    ).rejects.toThrow(NotFoundException);
    expect(carteraRepo.findOne).not.toHaveBeenCalled();
  });

  it("un propietario no puede descargar la evidencia de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(
      service.descargarEvidencia(1, 10, "foto_facial", propietarioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("descargarEvidencia lanza NotFound si el cliente no existe en la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.descargarEvidencia(1, 999, "foto_facial", adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("descargarEvidencia lanza NotFound si no hay evidencia de ese tipo", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.descargarEvidencia(1, 10, "foto_facial", adminContext),
    ).rejects.toThrow(NotFoundException);
  });
});