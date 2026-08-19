import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Liquidacion } from "../../src/modules/rutas/liquidacion.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Detalle/resumen de ruta (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let liquidacionRepo: Repository<Liquidacion>;
  let accessTokenAdmin: string;
  let rutaId: number;

  const ADMIN_USERNAME = "det-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Det2026";
  const PASSWORD = "Socio#Det2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-det";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-det";
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
    liquidacionRepo = moduleFixture.get(getRepositoryToken(Liquidacion));

    await liquidacionRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-DET-1" });
    await socioRepo.delete({ codigo: "SC-DET-1" });
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
      usuario: "socio-det-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-det-1@correo.com",
      telefono: "+59171160077",
      codigo: "SC-DET-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-det-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-det-1@correo.com",
      telefono: "+59172270077",
      codigo: "CB-DET-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta DET",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
      });
    rutaId = rutaRes.body.id as number;

    // Habilita los flags de visibilidad para que el resumen muestre todos los campos.
    await request(app.getHttpServer())
      .put(`/rutas/${rutaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        mostrarCaja: true,
        mostrarPrestamos: true,
        mostrarCobroEstimado: true,
        ocultarCartera: false,
      });
  });

  afterAll(async () => {
    await liquidacionRepo.createQueryBuilder().delete().execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-DET-1" });
    await socioRepo.delete({ codigo: "SC-DET-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /rutas/:id/resumen devuelve el resumen con caja y totales", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/resumen`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.rutaId).toBe(rutaId);
    expect(res.body.cajaActual).toBeDefined();
    expect(res.body.cajaAnterior).toBeDefined();
    expect(res.body.gastosPeriodo).toBeDefined();
    expect(res.body.cobradoPeriodo).toBeDefined();
    expect(res.body.prestadoPeriodo).toBeDefined();
    expect(res.body.inyeccionesPeriodo).toBeDefined();
    expect(res.body.carteraVigente).toBeDefined();
    expect(res.body.prestamosActivos).toBeDefined();
    expect(Array.isArray(res.body.clientes)).toBe(true);
  });

  it("GET /rutas/:id/resumen con ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/999999/resumen`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /rutas/:id/resumen sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/rutas/${rutaId}/resumen`);

    expect(res.status).toBe(401);
  });

  it("un socio SIN ver_reportes no puede ver el resumen -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-det-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-det-2@correo.com",
      telefono: "+59171160078",
      codigo: "SC-DET-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-det-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/resumen`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});