import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Abono } from "../../src/modules/cartera/abono.entity";
import { MensajeIa } from "../../src/modules/cartera/mensaje-ia.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Estado de cuenta del préstamo y envío del reporte (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let abonoRepo: Repository<Abono>;
  let mensajeRepo: Repository<MensajeIa>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;
  let prestamoId: number;

  const ADMIN_USERNAME = "estado-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Estado2026";
  const PASSWORD = "Socio#Estado2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-estado";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-estado";
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
    abonoRepo = moduleFixture.get(getRepositoryToken(Abono));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeIa));

    await mensajeRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta ESTADO')").execute();
    await rutaRepo.delete({ nombre: "Ruta ESTADO" });
    await cobradorRepo.delete({ codigo: "CB-ESTADO-1" });
    await socioRepo.delete({ codigo: "SC-ESTADO-1" });
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
      usuario: "socio-estado-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-estado-1@correo.com",
      telefono: "+59171160170",
      codigo: "SC-ESTADO-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-estado-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-estado-1@correo.com",
      telefono: "+59172270170",
      codigo: "CB-ESTADO-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta ESTADO",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 3,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Estado",
        apellido: "Cliente",
        negocio: "N",
        telefonoWhatsapp: "+59171160171",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId, valor: 300, numCuotas: 3, diasEntreCuotas: 7 });
    prestamoId = prestamoRes.body.id as number;
  });

  afterAll(async () => {
    await mensajeRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.delete({ id: prestamoId });
    await clienteRepo.delete({ id: clienteId });
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-ESTADO-1" });
    await socioRepo.delete({ codigo: "SC-ESTADO-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET .../prestamos/:prestamoId/estado-cuenta devuelve cuotas y totales", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/prestamos/${prestamoId}/estado-cuenta`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.prestamoId).toBe(prestamoId);
    expect(res.body.moneda).toBe("BOB");
    expect(res.body.cuotas).toHaveLength(3);
    expect(res.body.saldoPendiente).toBe(360);
    expect(res.body.totalAbonos).toBe(0);
    expect(res.body.cuotas[0]).toHaveProperty("saldoPendiente");
    expect(res.body.cuotas[0]).toHaveProperty("abonosAcumulados");
  });

  it("GET .../estado-cuenta con préstamo inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/prestamos/999999/estado-cuenta`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("POST .../prestamos/:prestamoId/enviar-reporte persiste el mensaje en el historial", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos/${prestamoId}/enviar-reporte`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(201);
    expect(res.body.conversacionId).toBeDefined();

    const enDb = await mensajeRepo.findOne({
      where: { intencionDetectada: "reporte_estado_cuenta" },
      order: { id: "DESC" },
    });
    expect(enDb).toBeDefined();
    expect(enDb?.emisor).toBe("ia");
    expect(enDb?.contenido).toContain("Estado de cuenta");
    expect(enDb?.contenido).toContain("Saldo pendiente");
  });

  it("GET .../estado-cuenta sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/prestamos/${prestamoId}/estado-cuenta`);

    expect(res.status).toBe(401);
  });

  it("un socio SIN generar_reporte no puede enviar el reporte -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-estado-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-estado-2@correo.com",
      telefono: "+59171160172",
      codigo: "SC-ESTADO-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-estado-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos/${prestamoId}/enviar-reporte`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});
