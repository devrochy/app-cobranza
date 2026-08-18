import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { PagosService } from "./pagos.service";
import { AbonosService } from "./abonos.service";
import { Visita } from "./visita.entity";
import { PromesaPago } from "./promesa-pago.entity";
import { VisitasService } from "./visitas.service";

describe("VisitasService", () => {
  let service: VisitasService;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let visitaRepo: Repository<Visita>;
  let promesaRepo: Repository<PromesaPago>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockClienteRepo = { findOne: jest.fn() };
  const mockPrestamoRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { findOne: jest.fn() };
  const mockVisitaRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockPromesaRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockPagosService = { registrarPagoDeCuota: jest.fn() };
  const mockAbonosService = { registrarAbono: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        save: jest.fn(async (e: { id?: number } & object) => {
          if (e && typeof e === "object" && !("id" in e)) {
            return { ...e, id: 123 };
          }
          return e;
        }),
        getRepository: jest.fn((entity: unknown) => {
          const repo = {
            create: jest.fn((e: unknown) => e),
            save: jest.fn(async (e: { id?: number } & object) => {
              if (e && typeof e === "object" && !("id" in e)) {
                return { ...e, id: 123 };
              }
              return e;
            }),
          };
          if (entity === PromesaPago) {
            // Reusa el mock de promesa para poder aseverar la creación.
            return mockPromesaRepo;
          }
          return repo;
        }),
      }),
    ),
  };

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
        VisitasService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(Prestamo), useValue: mockPrestamoRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Visita), useValue: mockVisitaRepo },
        { provide: getRepositoryToken(PromesaPago), useValue: mockPromesaRepo },
        { provide: PagosService, useValue: mockPagosService },
        { provide: AbonosService, useValue: mockAbonosService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(VisitasService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    clienteRepo = module.get(getRepositoryToken(Cliente));
    prestamoRepo = module.get(getRepositoryToken(Prestamo));
    visitaRepo = module.get(getRepositoryToken(Visita));
    promesaRepo = module.get(getRepositoryToken(PromesaPago));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrar(999, { prestamoId: 20, clienteId: 5, resultado: "no_pago", motivoNoPago: "no_esta" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede registrar una visita en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.registrar(1, { prestamoId: 20, clienteId: 5, resultado: "no_pago", motivoNoPago: "no_esta" }, socioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si el cliente no existe o no pertenece a la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrar(1, { prestamoId: 20, clienteId: 5, resultado: "no_pago", motivoNoPago: "no_esta" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("lanza NotFoundException si el préstamo principal no existe o no pertenece a la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrar(1, { prestamoId: 20, clienteId: 5, resultado: "no_pago", motivoNoPago: "no_esta" }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("rechaza con 400 si resultado no_pago sin motivo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente" } as Prestamo);

    await expect(
      service.registrar(1, { prestamoId: 20, clienteId: 5, resultado: "no_pago" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza con 400 si resultado pago sin valor ni método", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente" } as Prestamo);

    await expect(
      service.registrar(1, { prestamoId: 20, clienteId: 5, resultado: "pago" }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it("registra visita no_pago y crea promesa cuando el motivo es compromiso_de_pago", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente" } as Prestamo);
    (mockCuotaRepo.findOne as jest.Mock).mockResolvedValue({ id: 1, valorEsperado: 300 } as Cuota);
    (visitaRepo.findOne as jest.Mock).mockResolvedValue({
      id: 123,
      rutaId: 1,
      clienteId: 5,
      prestamoPrincipalId: 20,
      fecha: "2026-08-17",
      resultado: "no_pago",
      motivoNoPago: "compromiso_de_pago",
      valorPagado: null,
      metodoPago: null,
    } as Visita);

    const result = await service.registrar(
      1,
      {
        prestamoId: 20,
        clienteId: 5,
        resultado: "no_pago",
        motivoNoPago: "compromiso_de_pago",
        fechaPrometida: "2026-08-20",
      },
      adminContext,
    );

    expect(result.resultado).toBe("no_pago");
    expect(result.motivoNoPago).toBe("compromiso_de_pago");
    // B3: el default de valorPrometido es el valor de la cuota pendiente.
    expect(mockPromesaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: 20,
        fechaPrometida: "2026-08-20",
        valorPrometido: 300,
        estado: "pendiente",
      }),
    );
    expect(promesaRepo.save).toHaveBeenCalled();
  });

  it("rechaza con 400 si motivo compromiso_de_pago sin fechaPrometida", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente" } as Prestamo);

    await expect(
      service.registrar(
        1,
        { prestamoId: 20, clienteId: 5, resultado: "no_pago", motivoNoPago: "compromiso_de_pago" },
        adminContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("registra visita pago y delega el pago de cuota a PagosService con visitaId y manager", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente" } as Prestamo);
    (mockCuotaRepo.findOne as jest.Mock).mockResolvedValue({ id: 10, prestamoId: 20 } as Cuota);
    (mockPagosService.registrarPagoDeCuota as jest.Mock).mockResolvedValue({ id: 1 });
    (visitaRepo.findOne as jest.Mock).mockResolvedValue({
      id: 123,
      rutaId: 1,
      clienteId: 5,
      prestamoPrincipalId: 20,
      fecha: "2026-08-17",
      resultado: "pago",
      motivoNoPago: null,
      valorPagado: 120,
      metodoPago: "efectivo",
    } as Visita);

    const result = await service.registrar(
      1,
      { prestamoId: 20, clienteId: 5, resultado: "pago", tipoPago: "cuota", cuotaId: 10, valor: 120, metodoPago: "efectivo" },
      adminContext,
    );

    expect(result.resultado).toBe("pago");
    expect(mockPagosService.registrarPagoDeCuota).toHaveBeenCalledWith(
      1,
      { cuotaId: 10, valor: 120, metodoPago: "efectivo" },
      adminContext,
      { manager: expect.anything(), visitaId: 123 },
    );
  });

  it("rechaza con 404 si la cuota no pertenece al préstamo principal declarado", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente" } as Prestamo);
    (mockCuotaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.registrar(
        1,
        { prestamoId: 20, clienteId: 5, resultado: "pago", tipoPago: "cuota", cuotaId: 10, valor: 120, metodoPago: "efectivo" },
        adminContext,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("registra visita pago abono y delega a AbonosService con visitaId y manager", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente" } as Prestamo);
    (mockAbonosService.registrarAbono as jest.Mock).mockResolvedValue({ id: 1 });
    (visitaRepo.findOne as jest.Mock).mockResolvedValue({
      id: 124,
      rutaId: 1,
      clienteId: 5,
      prestamoPrincipalId: 20,
      fecha: "2026-08-17",
      resultado: "pago",
      motivoNoPago: null,
      valorPagado: 30,
      metodoPago: "transferencia",
    } as Visita);

    const result = await service.registrar(
      1,
      { prestamoId: 20, clienteId: 5, resultado: "pago", tipoPago: "abono", valor: 30, metodoPago: "transferencia" },
      adminContext,
    );

    expect(result.resultado).toBe("pago");
    expect(mockAbonosService.registrarAbono).toHaveBeenCalledWith(
      1,
      { prestamoId: 20, valor: 30, metodoPago: "transferencia" },
      adminContext,
      { manager: expect.anything(), visitaId: 123 },
    );
  });

  it("rechaza con 400 si resultado pago de cuota sin cuotaId", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 5 } as Cliente);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue({ id: 20, estatus: "vigente" } as Prestamo);

    await expect(
      service.registrar(
        1,
        { prestamoId: 20, clienteId: 5, resultado: "pago", tipoPago: "cuota", valor: 120, metodoPago: "efectivo" },
        adminContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
