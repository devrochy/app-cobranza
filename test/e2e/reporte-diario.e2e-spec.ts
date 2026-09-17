import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Pago } from "../../src/modules/clientes/pago.entity";
import { ConversacionIa } from "../../src/modules/clientes/conversacion-ia.entity";
import { MensajeIa } from "../../src/modules/clientes/mensaje-ia.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Visita } from "../../src/modules/clientes/visita.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Gasto } from "../../src/modules/carteras/gasto.entity";
import { ReporteDiario } from "../../src/modules/carteras/reporte-diario.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

function fechaLocal(offsetDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

describe("Reporte diario por cartera (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let visitaRepo: Repository<Visita>;
  let gastoRepo: Repository<Gasto>;
  let reporteRepo: Repository<ReporteDiario>;
  let conversacionRepo: Repository<ConversacionIa>;
  let mensajeRepo: Repository<MensajeIa>;

  let accessTokenAdmin: string;
  let carteraId: number;
  let gestorId: number;
  let clienteId: number;
  let prestamoId: number;
  let cuotaId: number;
  let cliente2Id: number;
  let prestamo2Id: number;
  let prestamo3Id: number;
  let cuota2Id: number;

  const ADMIN_USERNAME = "reporte-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Reporte2026";
  const PASSWORD = "Propietario#Reporte2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-reporte";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-reporte";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    adminRepo = moduleFixture.get(getRepositoryToken(AdminUser));
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));
    pagoRepo = moduleFixture.get(getRepositoryToken(Pago));
    visitaRepo = moduleFixture.get(getRepositoryToken(Visita));
    gastoRepo = moduleFixture.get(getRepositoryToken(Gasto));
    reporteRepo = moduleFixture.get(getRepositoryToken(ReporteDiario));
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionIa));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeIa));

    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await visitaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await reporteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-REP-1" });
    await propietarioRepo.delete({ codigo: "SC-REP-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });

    await adminRepo.save({
      usuario: ADMIN_USERNAME,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 4),
      estado: "activo",
      nombre: "Admin",
      apellido: "E2E",
      correo: null,
      telefono: null,
    });

    const adminLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    accessTokenAdmin = adminLogin.body.accessToken as string;

    const propietario = await propietarioRepo.save({
      usuario: "propietario-rep-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-rep-1@correo.com",
      telefono: "+59171160082",
      codigo: "SC-REP-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-rep-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-rep-1@correo.com",
      telefono: "+59172270082",
      codigo: "CB-REP-1",
      estatus: "activo",
    });
    gestorId = gestor.id;

    const cartera = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera REP-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 4,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraId = cartera.id;

    const clienteRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "test-Cliente",
        apellido: "Reporte",
        negocio: "test-Tienda",
        telefonoWhatsapp: "+59171160083",
        tipoDocumento: "ci",
        numeroDocumento: "7654321",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
    prestamoId = prestamoRes.body.id as number;

    const cuota = await cuotaRepo.findOneOrFail({
      where: { prestamo: { id: prestamoId } },
      order: { numeroCuota: "ASC" },
    });
    cuotaId = cuota.id;

    // La primera cuota vence hoy para que el cliente entre en la lista del día.
    await cuotaRepo.update({ id: cuotaId }, { fechaVencimiento: fechaLocal() });

    await pagoRepo.save({
      cuota: { id: cuotaId },
      cliente: { id: clienteId },
      valor: 300,
      metodoPago: "efectivo",
      liquidado: false,
    });

    await visitaRepo.save({
      cartera: { id: carteraId },
      cliente: { id: clienteId },
      prestamoPrincipal: { id: prestamoId },
      fecha: fechaLocal(),
      resultado: "pago",
      motivoNoPago: null,
      valorPagado: 300,
      metodoPago: "efectivo",
      creadoPorRol: "gestor",
      creadoPorId: gestorId,
    });

    const conversacion = await conversacionRepo.save({
      cliente: { id: clienteId },
      canal: "whatsapp",
      estado: "activa",
      motivoDerivacion: null,
      agenteAsignadoId: null,
      closedAt: null,
    });
    await mensajeRepo.save({
      conversacion: { id: conversacion.id },
      emisor: "ia",
      contenido: "test-recordatorio de pago",
      intencionDetectada: null,
      modeloUsado: null,
    });

    await gastoRepo.save({
      cartera: { id: carteraId },
      descripcion: "test-gasto del día",
      valor: 50,
      creadoPor: null,
      aprobado: true,
      aprobadoPor: null,
      estado: "activo",
    });

    // Cliente 2: paga desde el panel (sin visita) y además tiene un préstamo ya
    // liquidado con una cuota "atrasada" colgada (no debe contar como vencido).
    const cliente2Res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "test-Cliente",
        apellido: "Dos",
        negocio: "test-Tienda 2",
        telefonoWhatsapp: "+59171160085",
        tipoDocumento: "ci",
        numeroDocumento: "7654322",
        latitud: -17.79,
        longitud: -63.19,
      });
    cliente2Id = cliente2Res.body.id as number;

    const prestamo2Res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: cliente2Id, valor: 600, numCuotas: 2, diasEntreCuotas: 7 });
    prestamo2Id = prestamo2Res.body.id as number;

    const cuota2 = await cuotaRepo.findOneOrFail({
      where: { prestamo: { id: prestamo2Id } },
      order: { numeroCuota: "ASC" },
    });
    cuota2Id = cuota2.id;
    await cuotaRepo.update({ id: cuota2Id }, { fechaVencimiento: fechaLocal() });

    await pagoRepo.save({
      cuota: { id: cuota2Id },
      cliente: { id: cliente2Id },
      valor: 300,
      metodoPago: "efectivo",
      liquidado: false,
    });

    const prestamo3 = await prestamoRepo.save({
      cartera: { id: carteraId },
      cliente: { id: cliente2Id },
      valor: 400,
      numCuotas: 1,
      tipoInteres: 20,
      diasEntreCuotas: 7,
      fechaOtorgado: new Date(),
      fiadorNombre: null,
      fiadorApellido: null,
      fiadorDocumento: null,
      fiadorTelefono: null,
      estatus: "liquidado",
    });
    prestamo3Id = prestamo3.id;
    await cuotaRepo.save({
      prestamo: { id: prestamo3Id },
      numeroCuota: 1,
      valorEsperado: 400,
      fechaVencimiento: fechaLocal(-5),
      estatus: "atrasada",
    });
  });

  afterAll(async () => {
    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await visitaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await reporteRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.delete({ prestamo: { id: prestamoId } });
    await cuotaRepo.delete({ prestamo: { id: prestamo2Id } });
    await cuotaRepo.delete({ prestamo: { id: prestamo3Id } });
    await prestamoRepo.delete({ id: prestamoId });
    await prestamoRepo.delete({ id: prestamo2Id });
    await prestamoRepo.delete({ id: prestamo3Id });
    await clienteRepo.delete({ id: clienteId });
    await clienteRepo.delete({ id: cliente2Id });
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-REP-1" });
    await propietarioRepo.delete({ codigo: "SC-REP-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /carteras/:id/reporte-trayecto-diario devuelve los KPIs del día", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/reporte-trayecto-diario?fecha=${fechaLocal()}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.carteraId).toBe(carteraId);
    expect(res.body.cobradoDia).toBe(600);
    expect(res.body.cajaDiaSinGastos).toBe(600);
    expect(res.body.totalGastosDia).toBe(50);
    expect(res.body.cajaDiaConGastos).toBe(550);
    expect(res.body.horaPrimeraCuota).toMatch(/^\d{2}:\d{2}$/);
    expect(res.body.horaUltimaCuota).toMatch(/^\d{2}:\d{2}$/);
    expect(typeof res.body.porcentajeCobrarSemanal).toBe("number");
    expect(res.body.pagaron).toBe(2);
    expect(res.body.totalDia).toBeGreaterThanOrEqual(2);
    expect(res.body.faltan).toBe(res.body.totalDia - res.body.pagaron);
    expect(typeof res.body.clientesSinCuentas).toBe("number");
    // El cliente 2 pagó desde el panel (sin visita): no debe salir como no visitado.
    expect(res.body.clientesNoVisitados).toEqual([]);
    expect(res.body.clientesNotificados).toHaveLength(1);
    expect(res.body.clientesNotificados[0]).toEqual(
      expect.objectContaining({ clienteId, hora: expect.stringMatching(/^\d{2}:\d{2}$/) }),
    );
    expect(res.body.clientesNoVisitados).toEqual([]);
  });

  it("GET /carteras/:id/resumen ya no multiplica los totales por las liquidaciones (regresión)", async () => {
    await request(app.getHttpServer())
      .put(`/carteras/${carteraId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ mostrarCobroEstimado: true, mostrarPrestamos: true });

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/resumen`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.cobradoPeriodo).toBe(600);
    expect(res.body.gastosPeriodo).toBe(50);
    expect(res.body.prestadoPeriodo).toBe(2000);
  });

  it("GET /carteras/:id/reportes-trayecto-diario devuelve el historial mapeado", async () => {
    await reporteRepo.save(
      reporteRepo.create({
        cartera: { id: carteraId } as Cartera,
        fecha: fechaLocal(-1),
        cobradoDia: 123.45,
        prestadoDia: 1000,
        clientesVisitadosJson: [{ clienteId, nombre: "test-Cliente Reporte" }],
        clientesSinPagoJson: [],
        horaInicio: "09:15",
        horaFin: "17:40",
      }),
    );

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/reportes-trayecto-diario`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const ayer = res.body.find((r: { fecha: string }) => r.fecha === fechaLocal(-1));
    expect(ayer.cobradoDia).toBe(123.45);
    expect(ayer.horaInicio).toBe("09:15");
    expect(ayer.clientesVisitados).toEqual([{ clienteId, nombre: "test-Cliente Reporte" }]);
    expect(ayer.clientesSinPago).toEqual([]);
  });

  it("GET /carteras/:id/reportes-trayecto-diario/export devuelve un xlsx", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/reportes-trayecto-diario/export`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe("PK");
  });

  it("GET /carteras/:id/reporte-trayecto-diario sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraId}/reporte-trayecto-diario`);

    expect(res.status).toBe(401);
  });

  it("no cuenta como vencido un cliente con préstamo liquidado y cuota atrasada", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/estadisticas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.actual.clientesVencidos).toBe(0);
  });

  it("GET /carteras/:id/reporte-trayecto-diario con fecha inválida -> 400", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/reporte-trayecto-diario?fecha=abc`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(400);
  });

  it("un propietario SIN ver_reportes no puede ver el reporte -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-rep-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-rep-2@correo.com",
      telefono: "+59171160084",
      codigo: "SC-REP-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-rep-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/reporte-trayecto-diario`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});
