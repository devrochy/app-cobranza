import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Prestamo } from "./prestamo.entity";
import { Cuota } from "./cuota.entity";
import { Pago } from "./pago.entity";
import { Abono } from "./abono.entity";
import { Visita } from "./visita.entity";
import { DetalleCuotaService } from "./detalle-cuota.service";

describe("DetalleCuotaService", () => {
  let service: DetalleCuotaService;
  let rutaRepo: Repository<Ruta>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let abonoRepo: Repository<Abono>;
  let visitaRepo: Repository<Visita>;

  const cobradorContext = { rol: "cobrador" as const, sub: 7 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockPrestamoRepo = { findOne: jest.fn() };
  const mockCuotaRepo = { findOne: jest.fn(), find: jest.fn() };
  const mockPagoRepo = { find: jest.fn() };
  const mockAbonoRepo = { find: jest.fn() };
  const mockVisitaRepo = { find: jest.fn() };

  const ruta = {
    id: 1,
    socioId: 1,
    cobradorId: 7,
    nombre: "Ruta Centro",
    moneda: "COP",
  } as Ruta;

  const prestamo = {
    id: 5,
    rutaId: 1,
    clienteId: 10,
    valor: 300,
    numCuotas: 3,
    tipoInteres: 0,
    diasEntreCuotas: 7,
    estatus: "vigente",
  } as Prestamo;

  const cuotaUno = {
    id: 51,
    prestamoId: 5,
    numeroCuota: 1,
    valorEsperado: 100,
    fechaVencimiento: "2026-09-01",
    estatus: "pendiente",
  } as Cuota;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetalleCuotaService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Prestamo), useValue: mockPrestamoRepo },
        { provide: getRepositoryToken(Cuota), useValue: mockCuotaRepo },
        { provide: getRepositoryToken(Pago), useValue: mockPagoRepo },
        { provide: getRepositoryToken(Abono), useValue: mockAbonoRepo },
        { provide: getRepositoryToken(Visita), useValue: mockVisitaRepo },
      ],
    }).compile();

    service = module.get(DetalleCuotaService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    prestamoRepo = module.get(getRepositoryToken(Prestamo));
    cuotaRepo = module.get(getRepositoryToken(Cuota));
    pagoRepo = module.get(getRepositoryToken(Pago));
    abonoRepo = module.get(getRepositoryToken(Abono));
    visitaRepo = module.get(getRepositoryToken(Visita));

    (rutaRepo.findOne as jest.Mock).mockResolvedValue(ruta);
    (prestamoRepo.findOne as jest.Mock).mockResolvedValue(prestamo);
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(cuotaUno);
    (pagoRepo.find as jest.Mock).mockResolvedValue([]);
    (abonoRepo.find as jest.Mock).mockResolvedValue([]);
    (visitaRepo.find as jest.Mock).mockResolvedValue([]);
  });

  it("devuelve el detalle de la cuota con pagos y saldo", async () => {
    (cuotaRepo.find as jest.Mock).mockResolvedValue([
      { ...cuotaUno, id: 51 },
      { id: 52, prestamoId: 5, numeroCuota: 2, valorEsperado: 100, fechaVencimiento: "2026-09-08", estatus: "pendiente" } as Cuota,
    ]);
    (pagoRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 900,
        cuotaId: 51,
        valor: 100,
        metodoPago: "efectivo",
        fechaHora: new Date("2026-09-01T10:00:00Z"),
        registradoPor: 7,
      } as Pago,
    ]);

    const resultado = await service.obtener(1, 5, 51, cobradorContext);

    expect(pagoRepo.find).toHaveBeenCalledWith({
      where: { cuota: { id: 51 } },
      order: { fechaHora: "ASC" },
    });
    expect(abonoRepo.find).toHaveBeenCalledWith({
      where: { prestamo: { id: 5 } },
      order: { fechaHora: "ASC" },
    });
    expect(resultado.cuotaId).toBe(51);
    expect(resultado.numeroCuota).toBe(1);
    expect(resultado.pagos).toHaveLength(1);
    expect(resultado.pagos[0]).toMatchObject({
      valor: 100,
      metodoPago: "efectivo",
      registradoPor: 7,
    });
    expect(resultado.saldoPendiente).toBe(100);
    expect(resultado.ultimaVisita).toBeNull();
  });

  it("incluye abonos del préstamo y el estado liquidado de los pagos", async () => {
    (cuotaRepo.find as jest.Mock).mockResolvedValue([cuotaUno]);
    (pagoRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 900,
        cuotaId: 51,
        valor: 100,
        metodoPago: "efectivo",
        fechaHora: new Date("2026-09-01T10:00:00Z"),
        registradoPor: 7,
        liquidado: true,
        fechaLiquidacion: new Date("2026-09-01T20:00:00Z"),
      } as Pago,
    ]);
    (abonoRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 801,
        prestamoId: 5,
        clienteId: 10,
        valor: 40,
        metodoPago: "efectivo",
        fechaHora: new Date("2026-09-01T11:00:00Z"),
        liquidado: false,
        fechaLiquidacion: null,
      } as Abono,
    ]);

    const resultado = await service.obtener(1, 5, 51, cobradorContext);

    expect(resultado.pagos[0]).toMatchObject({ id: 900, liquidado: true });
    expect(resultado.abonos).toEqual([
      expect.objectContaining({ id: 801, valor: 40, liquidado: false }),
    ]);
  });

  it("incluye la última visita con motivo de no pago", async () => {
    (cuotaRepo.find as jest.Mock).mockResolvedValue([cuotaUno]);
    (visitaRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 77,
        prestamoPrincipalId: 5,
        fecha: "2026-09-01",
        resultado: "no_pago",
        motivoNoPago: "no_esta",
        valorPagado: null,
        metodoPago: null,
      } as Visita,
    ]);

    const resultado = await service.obtener(1, 5, 51, cobradorContext);

    expect(visitaRepo.find).toHaveBeenCalledWith({
      where: { prestamoPrincipal: { id: 5 } },
      order: { id: "DESC" },
    });
    expect(resultado.ultimaVisita).toMatchObject({
      resultado: "no_pago",
      motivoNoPago: "no_esta",
    });
  });

  it("lanza NotFound si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.obtener(1, 5, 51, cobradorContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("lanza NotFound si la cuota no pertenece al préstamo", async () => {
    (cuotaRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.obtener(1, 5, 51, cobradorContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("lanza Forbidden si el cobrador no pertenece a la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue({
      ...ruta,
      cobradorId: 99,
    });
    await expect(service.obtener(1, 5, 51, cobradorContext)).rejects.toThrow(
      expect.objectContaining({ name: "ForbiddenException" }),
    );
  });
});