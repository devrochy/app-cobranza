import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { ClienteEvidencia } from "./cliente-evidencia.entity";
import { ClienteTarjetaService } from "./cliente-tarjeta.service";

describe("ClienteTarjetaService", () => {
  let service: ClienteTarjetaService;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockClienteRepo = { findOne: jest.fn() };
  const mockEvidenciaRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockDataSource = { transaction: jest.fn() };

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

  function clienteFixture(overrides: Partial<Cliente> = {}): Cliente {
    return {
      id: 10,
      rutaId: 1,
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
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(ClienteEvidencia), useValue: mockEvidenciaRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(ClienteTarjetaService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    clienteRepo = module.get(getRepositoryToken(Cliente));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(999, 10, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede ver la tarjeta de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.obtener(1, 10, socioContext)).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si el cliente no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.obtener(1, 999, adminContext)).rejects.toThrow(NotFoundException);
  });

  it("construye la tarjeta con foto, tipo de pago, saldo y días de mora", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.find as jest.Mock).mockResolvedValue([
      { tipo: "foto_facial", rutaArchivo: "/uploads/foto.jpg" } as ClienteEvidencia,
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
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
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

  it("normaliza a URL servible los rutaArchivo absolutos del filesystem", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.find as jest.Mock).mockResolvedValue([
      {
        tipo: "foto_facial",
        rutaArchivo: "/Users/roaguilar/Projects/app-cobranza/uploads/clientes/foto.jpg",
      } as ClienteEvidencia,
      {
        tipo: "documento_frente",
        rutaArchivo: "/uploads/gastos/inexistente.jpg",
      } as ClienteEvidencia,
      {
        tipo: "documento_reverso",
        rutaArchivo: "/uploads/clientes/reverso.jpg",
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
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.findOne as jest.Mock).mockResolvedValue({
      tipo: "foto_facial",
      rutaArchivo: "/uploads/clientes/foto.jpg",
      nombreOriginal: "foto.jpg",
      mimetype: "image/jpeg",
    } as ClienteEvidencia);

    const result = await service.descargarEvidencia(1, 10, "foto_facial", adminContext);

    expect(result).toEqual({
      rutaArchivo: "/uploads/clientes/foto.jpg",
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
    expect(rutaRepo.findOne).not.toHaveBeenCalled();
  });

  it("un socio no puede descargar la evidencia de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.descargarEvidencia(1, 10, "foto_facial", socioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("descargarEvidencia lanza NotFound si el cliente no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.descargarEvidencia(1, 999, "foto_facial", adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("descargarEvidencia lanza NotFound si no hay evidencia de ese tipo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());
    (mockEvidenciaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.descargarEvidencia(1, 10, "foto_facial", adminContext),
    ).rejects.toThrow(NotFoundException);
  });
});