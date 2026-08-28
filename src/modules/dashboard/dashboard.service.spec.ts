import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Abono } from "../cartera/abono.entity";
import { Cliente } from "../cartera/cliente.entity";
import { Cuota } from "../cartera/cuota.entity";
import { Pago } from "../cartera/pago.entity";
import { Prestamo } from "../cartera/prestamo.entity";
import { Gasto } from "../rutas/gasto.entity";
import { Liquidacion } from "../rutas/liquidacion.entity";
import { Ruta } from "../rutas/ruta.entity";
import { Socio } from "../socios/socio.entity";
import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
  let service: DashboardService;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let abonoRepo: Repository<Abono>;
  let gastoRepo: Repository<Gasto>;
  let liquidacionRepo: Repository<Liquidacion>;
  let rutaRepo: Repository<Ruta>;
  let socioRepo: Repository<Socio>;

  const mockRepo = () => ({ sum: jest.fn(), count: jest.fn(), find: jest.fn() });

  const repos = {
    prestamo: mockRepo(),
    cuota: mockRepo(),
    pago: mockRepo(),
    abono: mockRepo(),
    gasto: mockRepo(),
    liquidacion: mockRepo(),
    ruta: mockRepo(),
    socio: mockRepo(),
    cliente: mockRepo(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Prestamo), useValue: repos.prestamo },
        { provide: getRepositoryToken(Cuota), useValue: repos.cuota },
        { provide: getRepositoryToken(Pago), useValue: repos.pago },
        { provide: getRepositoryToken(Abono), useValue: repos.abono },
        { provide: getRepositoryToken(Gasto), useValue: repos.gasto },
        { provide: getRepositoryToken(Liquidacion), useValue: repos.liquidacion },
        { provide: getRepositoryToken(Ruta), useValue: repos.ruta },
        { provide: getRepositoryToken(Socio), useValue: repos.socio },
        { provide: getRepositoryToken(Cliente), useValue: repos.cliente },
      ],
    }).compile();

    service = module.get(DashboardService);
    cuotaRepo = module.get(getRepositoryToken(Cuota));
    pagoRepo = module.get(getRepositoryToken(Pago));
    abonoRepo = module.get(getRepositoryToken(Abono));
    gastoRepo = module.get(getRepositoryToken(Gasto));
    liquidacionRepo = module.get(getRepositoryToken(Liquidacion));
    rutaRepo = module.get(getRepositoryToken(Ruta));
    socioRepo = module.get(getRepositoryToken(Socio));
  });

  it("consolida los indicadores financieros", async () => {
    (repos.cuota.sum as jest.Mock).mockResolvedValue(5000);
    (repos.cuota.count as jest.Mock).mockResolvedValue(10);
    (repos.pago.sum as jest.Mock).mockResolvedValue(300);
    (repos.abono.sum as jest.Mock).mockResolvedValue(100);
    (repos.gasto.sum as jest.Mock).mockResolvedValue(200);
    (repos.liquidacion.sum as jest.Mock).mockResolvedValue(80);
    (repos.ruta.count as jest.Mock).mockResolvedValue(3);
    (repos.socio.count as jest.Mock).mockResolvedValue(2);
    (repos.cliente.count as jest.Mock).mockResolvedValue(50);
    (repos.prestamo.count as jest.Mock).mockResolvedValue(15);

    const hoy = new Date("2026-08-26T00:00:00Z");
    const result = await service.obtener(hoy);

    expect(result.carteraActiva).toBe(5000);
    expect(result.moraTotal).toBe(5000);
    expect(result.cobradoDia).toBe(400);
    expect(result.cobradoSemana).toBe(400);
    expect(result.gastosPeriodo).toBe(200);
    expect(result.comisionesPeriodo).toBe(80);
    expect(result.rutasActivas).toBe(3);
    expect(result.sociosActivos).toBe(2);
    expect(result.clientesActivos).toBe(50);
    expect(result.prestamosVigentes).toBe(15);
  });

  it("trata sumas nulas como 0", async () => {
    (repos.cuota.sum as jest.Mock).mockResolvedValue(null);
    (repos.pago.sum as jest.Mock).mockResolvedValue(null);
    (repos.abono.sum as jest.Mock).mockResolvedValue(null);
    (repos.gasto.sum as jest.Mock).mockResolvedValue(null);
    (repos.liquidacion.sum as jest.Mock).mockResolvedValue(null);
    (repos.ruta.count as jest.Mock).mockResolvedValue(0);
    (repos.socio.count as jest.Mock).mockResolvedValue(0);
    (repos.cliente.count as jest.Mock).mockResolvedValue(0);
    (repos.prestamo.count as jest.Mock).mockResolvedValue(0);

    const result = await service.obtener(new Date("2026-08-26T00:00:00Z"));

    expect(result.carteraActiva).toBe(0);
    expect(result.cobradoDia).toBe(0);
    expect(result.comisionesPeriodo).toBe(0);
  });

  it("filtra cuotas de préstamos vigentes para la cartera activa y atrasadas para la mora", async () => {
    (repos.cuota.sum as jest.Mock).mockResolvedValue(100);
    (repos.cuota.count as jest.Mock).mockResolvedValue(0);
    (repos.pago.sum as jest.Mock).mockResolvedValue(null);
    (repos.abono.sum as jest.Mock).mockResolvedValue(null);
    (repos.gasto.sum as jest.Mock).mockResolvedValue(null);
    (repos.liquidacion.sum as jest.Mock).mockResolvedValue(null);
    (repos.ruta.count as jest.Mock).mockResolvedValue(0);
    (repos.socio.count as jest.Mock).mockResolvedValue(0);
    (repos.cliente.count as jest.Mock).mockResolvedValue(0);
    (repos.prestamo.count as jest.Mock).mockResolvedValue(0);

    await service.obtener(new Date("2026-08-26T00:00:00Z"));

    expect(cuotaRepo.sum).toHaveBeenCalledWith(
      "valorEsperado",
      expect.objectContaining({
        prestamo: { estatus: "vigente" },
      }),
    );
    expect(cuotaRepo.sum).toHaveBeenCalledWith(
      "valorEsperado",
      expect.objectContaining({
        estatus: "atrasada",
        prestamo: { estatus: "vigente" },
      }),
    );
  });

  it("filtra pagos/abonos por fecha y gastos aprobados del mes", async () => {
    (repos.cuota.sum as jest.Mock).mockResolvedValue(null);
    (repos.cuota.count as jest.Mock).mockResolvedValue(0);
    (repos.pago.sum as jest.Mock).mockResolvedValue(100);
    (repos.abono.sum as jest.Mock).mockResolvedValue(50);
    (repos.gasto.sum as jest.Mock).mockResolvedValue(30);
    (repos.liquidacion.sum as jest.Mock).mockResolvedValue(10);
    (repos.ruta.count as jest.Mock).mockResolvedValue(0);
    (repos.socio.count as jest.Mock).mockResolvedValue(0);
    (repos.cliente.count as jest.Mock).mockResolvedValue(0);
    (repos.prestamo.count as jest.Mock).mockResolvedValue(0);

    await service.obtener(new Date("2026-08-26T00:00:00Z"));

    expect(pagoRepo.sum).toHaveBeenCalledWith(
      "valor",
      expect.objectContaining({ fechaHora: expect.anything() }),
    );
    expect(abonoRepo.sum).toHaveBeenCalledWith(
      "valor",
      expect.objectContaining({ fechaHora: expect.anything() }),
    );
    expect(gastoRepo.sum).toHaveBeenCalledWith(
      "valor",
      expect.objectContaining({ aprobado: true, estado: "activo" }),
    );
    expect(liquidacionRepo.sum).toHaveBeenCalledWith(
      "comisionValor",
      expect.objectContaining({ fecha: expect.anything() }),
    );
  });

  it("acota cobradoDia al inicio del día en UTC y cobradoSemana a 7 días", async () => {
    (repos.cuota.sum as jest.Mock).mockResolvedValue(null);
    (repos.cuota.count as jest.Mock).mockResolvedValue(0);
    (repos.pago.sum as jest.Mock).mockResolvedValue(100);
    (repos.abono.sum as jest.Mock).mockResolvedValue(null);
    (repos.gasto.sum as jest.Mock).mockResolvedValue(null);
    (repos.liquidacion.sum as jest.Mock).mockResolvedValue(null);
    (repos.ruta.count as jest.Mock).mockResolvedValue(0);
    (repos.socio.count as jest.Mock).mockResolvedValue(0);
    (repos.cliente.count as jest.Mock).mockResolvedValue(0);
    (repos.prestamo.count as jest.Mock).mockResolvedValue(0);

    await service.obtener(new Date("2026-08-26T00:00:00Z"));

    const llamadas = (pagoRepo.sum as jest.Mock).mock.calls as Array<
      [string, { fechaHora: { _value?: Date } }]
    >;
    const dia = llamadas.find(([col]) => col === "valor")!;
    const inicioDia = (dia[1].fechaHora as unknown as { _value?: Date })._value;
    const inicioSemana = (llamadas[1][1].fechaHora as unknown as { _value?: Date })._value;
    expect(inicioDia?.toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(inicioSemana?.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("filtra por rutaId en todos los agregados", async () => {
    (repos.cuota.sum as jest.Mock).mockResolvedValue(null);
    (repos.cuota.count as jest.Mock).mockResolvedValue(0);
    (repos.pago.sum as jest.Mock).mockResolvedValue(null);
    (repos.abono.sum as jest.Mock).mockResolvedValue(null);
    (repos.gasto.sum as jest.Mock).mockResolvedValue(null);
    (repos.liquidacion.sum as jest.Mock).mockResolvedValue(null);
    (repos.ruta.count as jest.Mock).mockResolvedValue(0);
    (repos.socio.count as jest.Mock).mockResolvedValue(0);
    (repos.cliente.count as jest.Mock).mockResolvedValue(0);
    (repos.prestamo.count as jest.Mock).mockResolvedValue(0);
    (repos.ruta.find as jest.Mock).mockResolvedValue([{ id: 6, socioId: 3 }]);

    await service.obtener(new Date("2026-08-26T00:00:00Z"), { rutaId: 6 });

    expect(cuotaRepo.sum).toHaveBeenCalledWith(
      "valorEsperado",
      expect.objectContaining({
        prestamo: expect.objectContaining({ ruta: expect.any(Object) }),
      }),
    );
    expect(pagoRepo.sum).toHaveBeenCalledWith(
      "valor",
      expect.objectContaining({
        cliente: expect.objectContaining({ rutaId: expect.any(Object) }),
      }),
    );
    expect(gastoRepo.sum).toHaveBeenCalledWith(
      "valor",
      expect.objectContaining({
        rutaId: expect.any(Object),
        aprobado: true,
        estado: "activo",
      }),
    );
    expect(rutaRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rutaId: expect.any(Object) }),
      }),
    );
  });

  it("filtra por socioId resolviendo sus rutas", async () => {
    (repos.cuota.sum as jest.Mock).mockResolvedValue(null);
    (repos.cuota.count as jest.Mock).mockResolvedValue(0);
    (repos.pago.sum as jest.Mock).mockResolvedValue(null);
    (repos.abono.sum as jest.Mock).mockResolvedValue(null);
    (repos.gasto.sum as jest.Mock).mockResolvedValue(null);
    (repos.liquidacion.sum as jest.Mock).mockResolvedValue(null);
    (repos.ruta.count as jest.Mock).mockResolvedValue(0);
    (repos.socio.count as jest.Mock).mockResolvedValue(0);
    (repos.cliente.count as jest.Mock).mockResolvedValue(0);
    (repos.prestamo.count as jest.Mock).mockResolvedValue(0);
    (repos.ruta.find as jest.Mock).mockResolvedValue([
      { id: 6, socioId: 3 },
      { id: 7, socioId: 3 },
    ]);

    await service.obtener(new Date("2026-08-26T00:00:00Z"), { socioId: 3 });

    expect(repos.ruta.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { socioId: 3 } }),
    );
    expect(socioRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estatus: "activo" }),
      }),
    );
  });
});