import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Abono } from "../../src/modules/cartera/abono.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Pago } from "../../src/modules/cartera/pago.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { PromesaPago } from "../../src/modules/cartera/promesa-pago.entity";
import { Visita } from "../../src/modules/cartera/visita.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Caja } from "../../src/modules/rutas/caja.entity";
import { Gasto } from "../../src/modules/rutas/gasto.entity";
import { GastoEvidencia } from "../../src/modules/rutas/gasto-evidencia.entity";
import { ClienteEvidencia } from "../../src/modules/cartera/cliente-evidencia.entity";
import { ReporteDiario } from "../../src/modules/rutas/reporte-diario.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { RutaApertura } from "../../src/modules/rutas/ruta-apertura.entity";
import { RutaOptimizadaLog } from "../../src/modules/rutas/ruta-optimizada-log.entity";
import { PosicionCobrador } from "../../src/modules/rutas/posicion-cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("API del cobrador para la APK (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
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
  let logRepo: Repository<RutaOptimizadaLog>;
  let posicionRepo: Repository<PosicionCobrador>;
  let reporteRepo: Repository<ReporteDiario>;
  let cajaRepo: Repository<Caja>;
  let aperturaRepo: Repository<RutaApertura>;
  let accessTokenAdmin: string;
  let tokenCobrador1: string;
  let tokenCobrador2: string;
  let ruta1Id: number;
  let ruta2Id: number;
  let cliente1Id: number;
  let prestamo1Id: number;
  let cobrador1Id: number;
  let cobrador2Id: number;

  const ADMIN_USERNAME = "apk-e2e-admin";
  const ADMIN_PASSWORD = "apk-e2e-password";
  const PASSWORD = "password-seguro";

  const MATRIZ_COBRADOR1 = {
    registrar_prestamo: true,
    registrar_pago: true,
    registrar_abono: false,
    registrar_gasto: true,
    registrar_no_pago: true,
    anotar_notas_ruta: false,
    actualizar_cliente: true,
    eliminar_prestamo: false,
    eliminar_pago: true,
    eliminar_abono: true,
    eliminar_gasto: false,
    registrar_inyeccion: false,
    ver_cartera: true,
    generar_reporte: true,
  };

  async function loginCobrador(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/cobrador/login")
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
    await rutaRepo.createQueryBuilder().delete().execute();
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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
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
    logRepo = moduleFixture.get(getRepositoryToken(RutaOptimizadaLog));
    posicionRepo = moduleFixture.get(getRepositoryToken(PosicionCobrador));
    reporteRepo = moduleFixture.get(getRepositoryToken(ReporteDiario));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));
    aperturaRepo = moduleFixture.get(getRepositoryToken(RutaApertura));

    await limpiarDatos();
    await cobradorRepo.delete({ codigo: "CB-APK-1" });
    await cobradorRepo.delete({ codigo: "CB-APK-2" });
    await socioRepo.delete({ codigo: "SC-APK-1" });
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
      usuario: "socio-apk-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-apk-1@correo.com",
      telefono: "+59173330001",
      codigo: "SC-APK-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador1 = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-apk-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "Uno",
      correo: "cobrador-apk-1@correo.com",
      telefono: "+59174440001",
      codigo: "CB-APK-1",
      estatus: "activo",
    });
    cobrador1Id = cobrador1.id;

    const cobrador2 = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-apk-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "Dos",
      correo: "cobrador-apk-2@correo.com",
      telefono: "+59174440002",
      codigo: "CB-APK-2",
      estatus: "activo",
    });
    cobrador2Id = cobrador2.id;

    await request(app.getHttpServer())
      .put(`/cobradores/${cobrador1Id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: MATRIZ_COBRADOR1 });

    await request(app.getHttpServer())
      .put(`/cobradores/${cobrador2Id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { ver_cartera: true } });

    const ruta1Res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta APK Uno",
        socioId: socio.id,
        cobradorId: cobrador1.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    ruta1Id = ruta1Res.body.id as number;

    const ruta2Res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta APK Dos",
        socioId: socio.id,
        cobradorId: cobrador2.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    ruta2Id = ruta2Res.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${ruta1Id}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Juan",
        apellido: "Apk",
        negocio: "Tienda",
        telefonoWhatsapp: "+59173330002",
        latitud: -17.78,
        longitud: -63.18,
      });
    cliente1Id = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/rutas/${ruta1Id}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        clienteId: cliente1Id,
        valor: 1000,
        numCuotas: 4,
        diasEntreCuotas: 7,
      });
    prestamo1Id = prestamoRes.body.id as number;

    tokenCobrador1 = await loginCobrador("cobrador-apk-1");
    tokenCobrador2 = await loginCobrador("cobrador-apk-2");
  });

  afterAll(async () => {
    await limpiarDatos();
    await cobradorRepo.delete({ codigo: "CB-APK-1" });
    await cobradorRepo.delete({ codigo: "CB-APK-2" });
    await socioRepo.delete({ codigo: "SC-APK-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /cobrador/mis-rutas -> 200 con config y permisos de la ruta", async () => {
    const res = await request(app.getHttpServer())
      .get("/cobrador/mis-rutas")
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const miRuta = res.body.find((r: { id: number }) => r.id === ruta1Id);
    expect(miRuta).toBeDefined();
    expect(miRuta.nombre).toBe("Ruta APK Uno");
    expect(miRuta.config.periodoLiquidacion).toBeDefined();
    const verCartera = miRuta.permisos.find(
      (p: { permiso: string }) => p.permiso === "ver_cartera",
    );
    expect(verCartera.habilitado).toBe(true);
  });

  it("GET /cobrador/rutas/:id/dia -> 200 con clientes y trayectos null", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta1Id}/dia`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.clientes)).toBe(true);
    expect(res.body.trayectos).toBeNull();
  });

  it("POST /cobrador/rutas/:id/apertura -> 201 registra la apertura del día", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/apertura`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .send({ latitud: -17.78, longitud: -63.18 });

    if (res.status !== 201) {
      // eslint-disable-next-line no-console
      console.log("apertura body:", JSON.stringify(res.body));
    }
    expect(res.status).toBe(201);
    expect(res.body.rutaId).toBe(ruta1Id);
    expect(res.body.fecha).toBeDefined();
    expect(res.body.horaInicio).toBeDefined();
  });

  it("POST /cobrador/rutas/:id/posicion -> 201 registra la posición del cobrador", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/posicion`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .send({ latitud: -17.78, longitud: -63.18 });

    expect(res.status).toBe(201);
    expect(res.body.rutaId).toBe(ruta1Id);
    expect(res.body.cobradorId).toBe(cobrador1Id);
    expect(res.body.latitud).toBe(-17.78);
  });

  it("POST /cobrador/rutas/:id/apertura de una ruta ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta2Id}/apertura`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .send({ latitud: -17.78, longitud: -63.18 });

    expect(res.status).toBe(403);
  });

  it("POST /cobrador/rutas/:id/visitas/pago -> 201", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamo1Id }, numeroCuota: 1 },
    });

    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/visitas/pago`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
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
    expect(res.body.rutaId).toBe(ruta1Id);
  });

  it("POST /cobrador/rutas/:id/visitas/no-pago -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/visitas/no-pago`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
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

  it("POST /cobrador/rutas/:id/gastos -> 201 con evidencia", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/gastos`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .field("descripcion", "Combustible")
      .field("valor", "50")
      .attach("evidencias", Buffer.from("evidencia"), {
        filename: "evidencia.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(201);
    expect(res.body.descripcion).toBe("Combustible");
  });

  it("POST /cobrador/rutas/:id/trayectoria-real -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/trayectoria-real`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .send({
        puntos: [
          { latitud: -17.78, longitud: -63.18 },
          { latitud: -17.79, longitud: -63.19 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe("real");
  });

  it("GET /cobrador/rutas/:id/clientes/:clienteId/tarjeta -> 200", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta1Id}/clientes/${cliente1Id}/tarjeta`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(200);
    expect(res.body.clienteId).toBe(cliente1Id);
  });

  it("GET /cobrador/rutas/:id/clientes/:clienteId/prestamos -> 200 con cuotas", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta1Id}/clientes/${cliente1Id}/prestamos`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const prestamo = res.body.find((p: { id: number }) => p.id === prestamo1Id);
    expect(prestamo).toBeDefined();
    expect(Array.isArray(prestamo.cuotas)).toBe(true);
    expect(prestamo.cuotas[0].id).toBeGreaterThan(0);
  });

  it("POST /cobrador/rutas/:id/clientes/:clienteId/evidencias sube foto y documento", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/clientes/${cliente1Id}/evidencias`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .attach("foto_facial", Buffer.from("foto-test"), "foto.jpg")
      .attach("documento_frente", Buffer.from("doc-test"), "doc.jpg");

    expect(res.status).toBe(201);
    expect(res.body.clienteId).toBe(cliente1Id);
  });

  it("POST /cobrador/rutas/:id/clientes/:clienteId/evidencias en ruta ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta2Id}/clientes/${cliente1Id}/evidencias`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .attach("foto_facial", Buffer.from("x"), "f.jpg");

    expect(res.status).toBe(403);
  });

  it("GET /cobrador/rutas/:id/dia de una ruta ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta2Id}/dia`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(403);
  });

  it("POST /cobrador/rutas/:id/trayecto genera el trayecto planificado del día", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/trayecto`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);

    const dia = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta1Id}/dia`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);
    expect(dia.status).toBe(200);
    expect(dia.body.trayectos).not.toBeNull();
  });

  it("POST /cobrador/rutas/:id/trayecto de una ruta ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta2Id}/trayecto`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(403);
  });

  it("GET /cobrador/rutas/:id/clientes -> 200 con la lista completa de la ruta", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta1Id}/clientes`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const cliente = res.body.find((c: { id: number }) => c.id === cliente1Id);
    expect(cliente).toBeDefined();
    expect(cliente.id).toBe(cliente1Id);
    expect(cliente.rutaId).toBe(ruta1Id);
  });

  it("GET /cobrador/rutas/:id/clientes de una ruta ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta2Id}/clientes`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(403);
  });

  it("GET /cobrador/rutas/:id/prestamos/:prestamoId/estado-cuenta -> 200 con cuotas, saldos y abonos", async () => {
    const abonoRes = await request(app.getHttpServer())
      .post(`/rutas/${ruta1Id}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        prestamoId: prestamo1Id,
        valor: 50,
        metodoPago: "efectivo",
      });
    expect(abonoRes.status).toBe(201);

    const res = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta1Id}/prestamos/${prestamo1Id}/estado-cuenta`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

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

  it("GET /cobrador/rutas/:id/prestamos/:prestamoId/estado-cuenta de ruta ajena -> 403 (ownership)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobrador/rutas/${ruta2Id}/prestamos/${prestamo1Id}/estado-cuenta`)
      .set("Authorization", `Bearer ${tokenCobrador1}`);

    expect(res.status).toBe(403);
  });

  it("POST /cobrador/rutas/:id/prestamos -> 201 crea préstamo y cuotas", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta1Id}/prestamos`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
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

  it("POST /cobrador/rutas/:id/prestamos sin permiso registrar_prestamo -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta2Id}/prestamos`)
      .set("Authorization", `Bearer ${tokenCobrador2}`)
      .send({
        clienteId: cliente1Id,
        valor: 800,
        numCuotas: 4,
        diasEntreCuotas: 7,
      });

    expect(res.status).toBe(403);
  });

  it("POST /cobrador/rutas/:id/gastos sin permiso registrar_gasto -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobrador/rutas/${ruta2Id}/gastos`)
      .set("Authorization", `Bearer ${tokenCobrador2}`)
      .field("descripcion", "Sin permiso")
      .field("valor", "10");

    expect(res.status).toBe(403);
  });

  it("PATCH /cobrador/rutas/:id/cuotas/:cuotaId edita con re-autenticación -> 200", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamo1Id }, numeroCuota: 2 },
    });

    const res = await request(app.getHttpServer())
      .patch(`/cobrador/rutas/${ruta1Id}/cuotas/${cuota!.id}`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .send({ valorEsperado: 500, password: PASSWORD, motivo: "corrección" });

    expect(res.status).toBe(200);
    expect(res.body.valorEsperado).toBe(500);
  });

  it("PATCH /cobrador/rutas/:id/cuotas/:cuotaId sin permiso eliminar_pago -> 403", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamo1Id }, numeroCuota: 2 },
    });

    const res = await request(app.getHttpServer())
      .patch(`/cobrador/rutas/${ruta2Id}/cuotas/${cuota!.id}`)
      .set("Authorization", `Bearer ${tokenCobrador2}`)
      .send({ valorEsperado: 500, password: PASSWORD, motivo: "x" });

    expect(res.status).toBe(403);
  });

  it("DELETE /cobrador/rutas/:id/abonos/:abonoId elimina con re-autenticación -> 200", async () => {
    const abonoRes = await request(app.getHttpServer())
      .post(`/rutas/${ruta1Id}/abonos`)
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
      .delete(`/cobrador/rutas/${ruta1Id}/abonos/${abonoId}`)
      .set("Authorization", `Bearer ${tokenCobrador1}`)
      .send({ password: PASSWORD, motivo: "error de registro" });

    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.log("DELETE abono body:", JSON.stringify(res.body));
    }
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(abonoId);
  });

  it("DELETE /cobrador/rutas/:id/cuotas/:cuotaId sin permiso -> 403", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamo1Id }, numeroCuota: 2 },
    });

    const res = await request(app.getHttpServer())
      .delete(`/cobrador/rutas/${ruta2Id}/cuotas/${cuota!.id}`)
      .set("Authorization", `Bearer ${tokenCobrador2}`)
      .send({ password: PASSWORD, motivo: "x" });

    expect(res.status).toBe(403);
  });
});