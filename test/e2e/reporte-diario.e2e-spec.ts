import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Pago } from "../../src/modules/cartera/pago.entity";
import { ConversacionIa } from "../../src/modules/cartera/conversacion-ia.entity";
import { MensajeIa } from "../../src/modules/cartera/mensaje-ia.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Visita } from "../../src/modules/cartera/visita.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Gasto } from "../../src/modules/rutas/gasto.entity";
import { ReporteDiario } from "../../src/modules/rutas/reporte-diario.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

function fechaLocal(offsetDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

describe("Reporte diario por ruta (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
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
  let rutaId: number;
  let cobradorId: number;
  let clienteId: number;
  let prestamoId: number;
  let cuotaId: number;

  const ADMIN_USERNAME = "reporte-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Reporte2026";
  const PASSWORD = "Socio#Reporte2026";

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
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
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-REP-1" });
    await socioRepo.delete({ codigo: "SC-REP-1" });
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

    const socio = await socioRepo.save({
      usuario: "socio-rep-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-rep-1@correo.com",
      telefono: "+59171160082",
      codigo: "SC-REP-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-rep-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-rep-1@correo.com",
      telefono: "+59172270082",
      codigo: "CB-REP-1",
      estatus: "activo",
    });
    cobradorId = cobrador.id;

    const ruta = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta REP-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 4,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaId = ruta.id;

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
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
      .post(`/rutas/${rutaId}/prestamos`)
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
      ruta: { id: rutaId },
      cliente: { id: clienteId },
      prestamoPrincipal: { id: prestamoId },
      fecha: fechaLocal(),
      resultado: "pago",
      motivoNoPago: null,
      valorPagado: 300,
      metodoPago: "efectivo",
      creadoPorRol: "cobrador",
      creadoPorId: cobradorId,
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
      ruta: { id: rutaId },
      descripcion: "test-gasto del día",
      valor: 50,
      creadoPor: null,
      aprobado: true,
      aprobadoPor: null,
      estado: "activo",
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
    await prestamoRepo.delete({ id: prestamoId });
    await clienteRepo.delete({ id: clienteId });
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-REP-1" });
    await socioRepo.delete({ codigo: "SC-REP-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /rutas/:id/reporte-dia devuelve los KPIs del día", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/reporte-dia?fecha=${fechaLocal()}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.rutaId).toBe(rutaId);
    expect(res.body.cobradoDia).toBe(300);
    expect(res.body.cajaDiaSinGastos).toBe(300);
    expect(res.body.totalGastosDia).toBe(50);
    expect(res.body.cajaDiaConGastos).toBe(250);
    expect(res.body.horaPrimeraCuota).toMatch(/^\d{2}:\d{2}$/);
    expect(res.body.horaUltimaCuota).toMatch(/^\d{2}:\d{2}$/);
    expect(typeof res.body.porcentajeCobrarSemanal).toBe("number");
    expect(res.body.pagaron).toBe(1);
    expect(res.body.totalDia).toBeGreaterThanOrEqual(1);
    expect(res.body.faltan).toBe(res.body.totalDia - res.body.pagaron);
    expect(typeof res.body.clientesSinCuentas).toBe("number");
    expect(res.body.clientesNotificados).toHaveLength(1);
    expect(res.body.clientesNotificados[0]).toEqual(
      expect.objectContaining({ clienteId, hora: expect.stringMatching(/^\d{2}:\d{2}$/) }),
    );
    expect(res.body.clientesNoVisitados).toEqual([]);
  });

  it("GET /rutas/:id/resumen ya no multiplica los totales por las liquidaciones (regresión)", async () => {
    await request(app.getHttpServer())
      .put(`/rutas/${rutaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ mostrarCobroEstimado: true, mostrarPrestamos: true });

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/resumen`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.cobradoPeriodo).toBe(300);
    expect(res.body.gastosPeriodo).toBe(50);
    expect(res.body.prestadoPeriodo).toBe(1000);
  });

  it("GET /rutas/:id/reportes-diarios devuelve el historial mapeado", async () => {
    await reporteRepo.save(
      reporteRepo.create({
        ruta: { id: rutaId } as Ruta,
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
      .get(`/rutas/${rutaId}/reportes-diarios`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const ayer = res.body.find((r: { fecha: string }) => r.fecha === fechaLocal(-1));
    expect(ayer.cobradoDia).toBe(123.45);
    expect(ayer.horaInicio).toBe("09:15");
    expect(ayer.clientesVisitados).toEqual([{ clienteId, nombre: "test-Cliente Reporte" }]);
    expect(ayer.clientesSinPago).toEqual([]);
  });

  it("GET /rutas/:id/reportes-diarios/export devuelve un xlsx", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/reportes-diarios/export`)
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

  it("GET /rutas/:id/reporte-dia sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/rutas/${rutaId}/reporte-dia`);

    expect(res.status).toBe(401);
  });

  it("un socio SIN ver_reportes no puede ver el reporte -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-rep-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-rep-2@correo.com",
      telefono: "+59171160084",
      codigo: "SC-REP-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-rep-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/reporte-dia`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});
