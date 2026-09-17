import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Abono } from "../../src/modules/clientes/abono.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Pago } from "../../src/modules/clientes/pago.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { PromesaPago } from "../../src/modules/clientes/promesa-pago.entity";
import { Visita } from "../../src/modules/clientes/visita.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Caja } from "../../src/modules/carteras/caja.entity";
import { Gasto } from "../../src/modules/carteras/gasto.entity";
import { GastoEvidencia } from "../../src/modules/carteras/gasto-evidencia.entity";
import { ClienteEvidencia } from "../../src/modules/clientes/cliente-evidencia.entity";
import { ReporteDiario } from "../../src/modules/carteras/reporte-diario.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { CarteraApertura } from "../../src/modules/carteras/cartera-apertura.entity";
import { CarteraOptimizadaLog } from "../../src/modules/carteras/cartera-optimizada-log.entity";
import { PosicionGestor } from "../../src/modules/carteras/posicion-gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("API del gestor para la APK (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let abonoRepo: Repository<Abono>;
  let prestamoRepo: Repository<Prestamo>;
  let visitaRepo: Repository<Visita>;
  let promesaRepo: Repository<PromesaPago>;
  let gastoRepo: Repository<Gasto>;
  let evidenciaRepo: Repository<GastoEvidencia>;
  let clienteEvidenciaRepo: Repository<ClienteEvidencia>;
  let logRepo: Repository<CarteraOptimizadaLog>;
  let posicionRepo: Repository<PosicionGestor>;
  let reporteRepo: Repository<ReporteDiario>;
  let cajaRepo: Repository<Caja>;
  let aperturaRepo: Repository<CarteraApertura>;
  let accessTokenAdmin: string;
  let tokenGestor1: string;
  let tokenGestor2: string;
  let tokenGestor3: string;
  let cartera1Id: number;
  let cartera2Id: number;
  let cliente1Id: number;
  let prestamo1Id: number;
  let gestor1Id: number;
  let gestor2Id: number;

  const ADMIN_USERNAME = "apk-e2e-admin";
  const ADMIN_PASSWORD = "apk-e2e-password";
  const PASSWORD = "password-seguro";

  const MATRIZ_GESTOR1 = {
    registrar_prestamo: true,
    registrar_pago: true,
    registrar_abono: false,
    registrar_gasto: true,
    registrar_no_pago: true,
    anotar_notas_cartera: false,
    actualizar_cliente: true,
    eliminar_prestamo: false,
    eliminar_pago: true,
    eliminar_abono: true,
    eliminar_gasto: false,
    registrar_inyeccion: false,
    ver_cartera: true,
    generar_reporte: true,
    actualizar_cartera: true,
  };

  async function loginGestor(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  async function limpiarDatos(): Promise<void> {
    await evidenciaRepo.createQueryBuilder().delete().execute();
    await clienteEvidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await posicionRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await promesaRepo.createQueryBuilder().delete().execute();
    await visitaRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await logRepo.createQueryBuilder().delete().execute();
    await aperturaRepo.createQueryBuilder().delete().execute();
    await reporteRepo.createQueryBuilder().delete().execute();
    await cajaRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "apk-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "apk-e2e-refresh-secret";
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
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));
    pagoRepo = moduleFixture.get(getRepositoryToken(Pago));
    abonoRepo = moduleFixture.get(getRepositoryToken(Abono));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    visitaRepo = moduleFixture.get(getRepositoryToken(Visita));
    promesaRepo = moduleFixture.get(getRepositoryToken(PromesaPago));
    gastoRepo = moduleFixture.get(getRepositoryToken(Gasto));
    evidenciaRepo = moduleFixture.get(getRepositoryToken(GastoEvidencia));
    clienteEvidenciaRepo = moduleFixture.get(getRepositoryToken(ClienteEvidencia));
    logRepo = moduleFixture.get(getRepositoryToken(CarteraOptimizadaLog));
    posicionRepo = moduleFixture.get(getRepositoryToken(PosicionGestor));
    reporteRepo = moduleFixture.get(getRepositoryToken(ReporteDiario));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));
    aperturaRepo = moduleFixture.get(getRepositoryToken(CarteraApertura));

    await limpiarDatos();
    await gestorRepo.delete({ codigo: "CB-APK-1" });
    await gestorRepo.delete({ codigo: "CB-APK-2" });
    await gestorRepo.delete({ codigo: "CB-APK-3" });
    await propietarioRepo.delete({ codigo: "SC-APK-1" });
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
      usuario: "propietario-apk-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-apk-1@correo.com",
      telefono: "+59173330001",
      codigo: "SC-APK-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor1 = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-apk-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "Uno",
      correo: "gestor-apk-1@correo.com",
      telefono: "+59174440001",
      codigo: "CB-APK-1",
      estatus: "activo",
    });
    gestor1Id = gestor1.id;

    const gestor2 = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-apk-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "Dos",
      correo: "gestor-apk-2@correo.com",
      telefono: "+59174440002",
      codigo: "CB-APK-2",
      estatus: "activo",
    });
    gestor2Id = gestor2.id;

    await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-apk-3",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "Tres",
      correo: "gestor-apk-3@correo.com",
      telefono: "+59174440003",
      codigo: "CB-APK-3",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/gestores/${gestor1Id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: MATRIZ_GESTOR1 });

    await request(app.getHttpServer())
      .put(`/gestores/${gestor2Id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { ver_cartera: true } });

    const cartera1Res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera APK Uno",
        propietarioId: propietario.id,
        gestorId: gestor1.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    cartera1Id = cartera1Res.body.id as number;

    const cartera2Res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera APK Dos",
        propietarioId: propietario.id,
        gestorId: gestor2.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    cartera2Id = cartera2Res.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/carteras/${cartera1Id}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Juan",
        apellido: "Apk",
        negocio: "Tienda",
        telefonoWhatsapp: "+59173330002",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
    cliente1Id = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/carteras/${cartera1Id}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        clienteId: cliente1Id,
        valor: 1000,
        numCuotas: 4,
        diasEntreCuotas: 7,
      });
    prestamo1Id = prestamoRes.body.id as number;

    tokenGestor1 = await loginGestor("gestor-apk-1");
    tokenGestor2 = await loginGestor("gestor-apk-2");
    tokenGestor3 = await loginGestor("gestor-apk-3");
  });

  afterAll(async () => {
    await limpiarDatos();
    await gestorRepo.delete({ codigo: "CB-APK-1" });
    await gestorRepo.delete({ codigo: "CB-APK-2" });
    await gestorRepo.delete({ codigo: "CB-APK-3" });
    await propietarioRepo.delete({ codigo: "SC-APK-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /gestor/mis-carteras -> 200 con config y permisos de la cartera", async () => {
    const res = await request(app.getHttpServer())
      .get("/gestor/mis-carteras")
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const miCartera = res.body.find((r: { id: number }) => r.id === cartera1Id);
    expect(miCartera).toBeDefined();
    expect(miCartera.nombre).toBe("Cartera APK Uno");
    expect(miCartera.config.periodoLiquidacion).toBeDefined();
    const verCartera = miCartera.permisos.find(
      (p: { permiso: string }) => p.permiso === "ver_cartera",
    );
    expect(verCartera.habilitado).toBe(true);
  });

  it("GET /gestor/carteras/:id/trayecto-diario -> 200 con clientes y trayectos null", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera1Id}/trayecto-diario`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.clientes)).toBe(true);
    expect(res.body.trayectos).toBeNull();
  });

  it("POST /gestor/carteras/:id/apertura -> 201 registra la apertura del día", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/apertura`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ latitud: -17.78, longitud: -63.18 });

    if (res.status !== 201) {
      // eslint-disable-next-line no-console
      console.log("apertura body:", JSON.stringify(res.body));
    }
    expect(res.status).toBe(201);
    expect(res.body.carteraId).toBe(cartera1Id);
    expect(res.body.fecha).toBeDefined();
    expect(res.body.horaInicio).toBeDefined();
  });

  it("POST /gestor/carteras/:id/posicion -> 201 registra la posición del gestor", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/posicion`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ latitud: -17.78, longitud: -63.18 });

    expect(res.status).toBe(201);
    expect(res.body.carteraId).toBe(cartera1Id);
    expect(res.body.gestorId).toBe(gestor1Id);
    expect(res.body.latitud).toBe(-17.78);
  });

  it("POST /gestor/carteras/:id/apertura de una cartera ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera2Id}/apertura`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ latitud: -17.78, longitud: -63.18 });

    expect(res.status).toBe(403);
  });

  it("POST /gestor/carteras/:id/visitas/pago -> 201", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamo1Id }, numeroCuota: 1 },
    });

    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/visitas/pago`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({
        prestamoId: prestamo1Id,
        clienteId: cliente1Id,
        resultado: "pago",
        tipoPago: "cuota",
        cuotaId: cuota!.id,
        valor: cuota!.valorEsperado,
        metodoPago: "efectivo",
      });

    expect(res.status).toBe(201);
    expect(res.body.resultado).toBe("pago");
    expect(res.body.carteraId).toBe(cartera1Id);
  });

  it("POST /gestor/carteras/:id/visitas/no-pago -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/visitas/no-pago`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({
        prestamoId: prestamo1Id,
        clienteId: cliente1Id,
        resultado: "no_pago",
        motivoNoPago: "no_tiene_dinero",
      });

    expect(res.status).toBe(201);
    expect(res.body.resultado).toBe("no_pago");
    expect(res.body.motivoNoPago).toBe("no_tiene_dinero");
  });

  it("POST /gestor/carteras/:id/gastos -> 201 con evidencia", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/gastos`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .field("descripcion", "Combustible")
      .field("valor", "50")
      .attach("evidencias", Buffer.from("evidencia"), {
        filename: "evidencia.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(201);
    expect(res.body.descripcion).toBe("Combustible");
  });

  it("POST /gestor/carteras/:id/trayectoria-real -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/trayectoria-real`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({
        puntos: [
          { latitud: -17.78, longitud: -63.18 },
          { latitud: -17.79, longitud: -63.19 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe("real");
  });

  it("GET /gestor/carteras/:id/clientes/:clienteId/tarjeta -> 200", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera1Id}/clientes/${cliente1Id}/tarjeta`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(200);
    expect(res.body.clienteId).toBe(cliente1Id);
  });

  it("GET /gestor/carteras/:id/clientes/:clienteId/prestamos -> 200 con cuotas", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera1Id}/clientes/${cliente1Id}/prestamos`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const prestamo = res.body.find((p: { id: number }) => p.id === prestamo1Id);
    expect(prestamo).toBeDefined();
    expect(Array.isArray(prestamo.cuotas)).toBe(true);
    expect(prestamo.cuotas[0].id).toBeGreaterThan(0);
  });

  it("POST /gestor/carteras/:id/clientes/:clienteId/evidencias sube foto y documento", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/clientes/${cliente1Id}/evidencias`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .attach("foto_facial", Buffer.from("foto-test"), "foto.jpg")
      .attach("documento_frente", Buffer.from("doc-test"), "doc.jpg");

    expect(res.status).toBe(201);
    expect(res.body.clienteId).toBe(cliente1Id);
  });

  it("POST /gestor/carteras/:id/clientes/:clienteId/evidencias en cartera ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera2Id}/clientes/${cliente1Id}/evidencias`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .attach("foto_facial", Buffer.from("x"), "f.jpg");

    expect(res.status).toBe(403);
  });

  it("GET /gestor/carteras/:id/trayecto-diario de una cartera ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera2Id}/trayecto-diario`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(403);
  });

  it("POST /gestor/carteras/:id/trayecto genera el trayecto planificado del día", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/trayecto`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);

    const dia = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera1Id}/trayecto-diario`)
      .set("Authorization", `Bearer ${tokenGestor1}`);
    expect(dia.status).toBe(200);
    expect(dia.body.trayectos).not.toBeNull();
  });

  it("POST /gestor/carteras/:id/trayecto de una cartera ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera2Id}/trayecto`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(403);
  });

  it("GET /gestor/carteras/:id/clientes -> 200 con la lista completa de la cartera", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera1Id}/clientes`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const cliente = res.body.find((c: { id: number }) => c.id === cliente1Id);
    expect(cliente).toBeDefined();
    expect(cliente.id).toBe(cliente1Id);
    expect(cliente.carteraId).toBe(cartera1Id);
  });

  it("GET /gestor/carteras/:id/clientes de una cartera ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera2Id}/clientes`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(403);
  });

  it("GET /gestor/carteras/:id/prestamos/:prestamoId/estado-cuenta -> 200 con cuotas, saldos y abonos", async () => {
    const abonoRes = await request(app.getHttpServer())
      .post(`/carteras/${cartera1Id}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        prestamoId: prestamo1Id,
        valor: 50,
        metodoPago: "efectivo",
      });
    expect(abonoRes.status).toBe(201);

    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera1Id}/prestamos/${prestamo1Id}/estado-cuenta`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(200);
    expect(res.body.prestamoId).toBe(prestamo1Id);
    expect(res.body.clienteId).toBe(cliente1Id);
    expect(Array.isArray(res.body.cuotas)).toBe(true);
    const cuota = res.body.cuotas[0];
    expect(cuota.cuotaId).toBeGreaterThan(0);
    expect(typeof cuota.saldoPendiente).toBe("number");
    expect(typeof cuota.abonosAcumulados).toBe("number");
    expect(res.body.saldoPendiente).toBeGreaterThanOrEqual(0);
  });

  it("GET /gestor/carteras/:id/prestamos/:prestamoId/estado-cuenta de cartera ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera2Id}/prestamos/${prestamo1Id}/estado-cuenta`)
      .set("Authorization", `Bearer ${tokenGestor1}`);

    expect(res.status).toBe(403);
  });

  it("POST /gestor/carteras/:id/prestamos -> 201 crea préstamo y cuotas", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/prestamos`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({
        clienteId: cliente1Id,
        valor: 800,
        numCuotas: 4,
        diasEntreCuotas: 7,
      });

    expect(res.status).toBe(201);
    expect(res.body.clienteId).toBe(cliente1Id);
    expect(res.body.cuotas).toHaveLength(4);
  });

  it("POST /gestor/carteras/:id/prestamos sin permiso registrar_prestamo -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera2Id}/prestamos`)
      .set("Authorization", `Bearer ${tokenGestor2}`)
      .send({
        clienteId: cliente1Id,
        valor: 800,
        numCuotas: 4,
        diasEntreCuotas: 7,
      });

    expect(res.status).toBe(403);
  });

  it("POST /gestor/carteras/:id/gastos sin permiso registrar_gasto -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera2Id}/gastos`)
      .set("Authorization", `Bearer ${tokenGestor2}`)
      .field("descripcion", "Sin permiso")
      .field("valor", "10");

    expect(res.status).toBe(403);
  });

  it("PATCH /gestor/carteras/:id/cuotas/:cuotaId edita con re-autenticación -> 200", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamo1Id }, numeroCuota: 2 },
    });

    const res = await request(app.getHttpServer())
      .patch(`/gestor/carteras/${cartera1Id}/cuotas/${cuota!.id}`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ valorEsperado: 500, password: PASSWORD, motivo: "corrección" });

    expect(res.status).toBe(200);
    expect(res.body.valorEsperado).toBe(500);
  });

  it("PATCH /gestor/carteras/:id/cuotas/:cuotaId sin permiso eliminar_pago -> 403", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamo1Id }, numeroCuota: 2 },
    });

    const res = await request(app.getHttpServer())
      .patch(`/gestor/carteras/${cartera2Id}/cuotas/${cuota!.id}`)
      .set("Authorization", `Bearer ${tokenGestor2}`)
      .send({ valorEsperado: 500, password: PASSWORD, motivo: "x" });

    expect(res.status).toBe(403);
  });

  it("DELETE /gestor/carteras/:id/abonos/:abonoId elimina con re-autenticación -> 200", async () => {
    const abonoRes = await request(app.getHttpServer())
      .post(`/carteras/${cartera1Id}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        prestamoId: prestamo1Id,
        valor: 100,
        metodoPago: "efectivo",
      });
    const abonoId = abonoRes.body.id as number;
    if (typeof abonoId !== "number" || abonoRes.status !== 201) {
      // eslint-disable-next-line no-console
      console.log("POST abono body:", JSON.stringify(abonoRes.body), "status:", abonoRes.status);
    }

    const res = await request(app.getHttpServer())
      .delete(`/gestor/carteras/${cartera1Id}/abonos/${abonoId}`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ password: PASSWORD, motivo: "error de registro" });

    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.log("DELETE abono body:", JSON.stringify(res.body));
    }
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(abonoId);
  });

  it("DELETE /gestor/carteras/:id/cuotas/:cuotaId sin permiso -> 403", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamo1Id }, numeroCuota: 2 },
    });

    const res = await request(app.getHttpServer())
      .delete(`/gestor/carteras/${cartera2Id}/cuotas/${cuota!.id}`)
      .set("Authorization", `Bearer ${tokenGestor2}`)
      .send({ password: PASSWORD, motivo: "x" });

    expect(res.status).toBe(403);
  });

  it("POST /gestor/carteras/:id/gastos con mimetype inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/gastos`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .field("descripcion", "Texto")
      .field("valor", "10")
      .attach("evidencias", Buffer.from("no es imagen"), {
        filename: "nota.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
  });

  it("POST /gestor/carteras/:id/gastos sin archivos -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/gastos`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .field("descripcion", "Sin evidencia")
      .field("valor", "10");

    expect(res.status).toBe(201);
  });

  it("POST /gestor/carteras/:id/trayectoria-real con menos de 2 puntos -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/gestor/carteras/${cartera1Id}/trayectoria-real`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ puntos: [{ latitud: -17.78, longitud: -63.18 }] });

    expect(res.status).toBe(400);
  });

  it("GET /gestor/carteras/:id/clientes/:clienteId/tarjeta de un cliente de otra cartera -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${cartera2Id}/clientes/${cliente1Id}/tarjeta`)
      .set("Authorization", `Bearer ${tokenGestor2}`);

    expect(res.status).toBe(404);
  });

  it("GET /gestor/mis-carteras sin permiso ver_cartera -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get("/gestor/mis-carteras")
      .set("Authorization", `Bearer ${tokenGestor3}`);

    expect(res.status).toBe(403);
  });

  it("GET /gestor/mis-carteras sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/gestor/mis-carteras");

    expect(res.status).toBe(401);
  });

  it("PATCH /gestor/carteras/:id actualiza el nombre con permiso -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestor/carteras/${cartera1Id}`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ nombre: "Cartera APK Uno editada" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Cartera APK Uno editada");
  });

  it("PATCH /gestor/carteras/:id/configuracion actualiza tipoInteres/numCuotas -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestor/carteras/${cartera1Id}/configuracion`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ tipoInteres: 15, numCuotas: 6 });

    expect(res.status).toBe(200);
    expect(res.body.tipoInteres).toBe(15);
    expect(res.body.numCuotas).toBe(6);
  });

  it("PATCH /gestor/carteras/:id sin permiso actualizar_cartera -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestor/carteras/${cartera1Id}`)
      .set("Authorization", `Bearer ${tokenGestor2}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(403);
  });

  it("PATCH /gestor/carteras/:id de una cartera ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestor/carteras/${cartera2Id}`)
      .set("Authorization", `Bearer ${tokenGestor1}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(403);
  });
});