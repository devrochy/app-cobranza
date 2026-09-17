import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Liquidacion } from "../../src/modules/carteras/liquidacion.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Detalle/resumen de cartera (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let liquidacionRepo: Repository<Liquidacion>;
  let accessTokenAdmin: string;
  let carteraId: number;

  const ADMIN_USERNAME = "det-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Det2026";
  const PASSWORD = "Propietario#Det2026";

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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    liquidacionRepo = moduleFixture.get(getRepositoryToken(Liquidacion));

    await liquidacionRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-DET-1" });
    await propietarioRepo.delete({ codigo: "SC-DET-1" });
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
      usuario: "propietario-det-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-det-1@correo.com",
      telefono: "+59171160077",
      codigo: "SC-DET-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-det-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-det-1@correo.com",
      telefono: "+59172270077",
      codigo: "CB-DET-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera DET",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    // Habilita los flags de visibilidad para que el resumen muestre todos los campos.
    await request(app.getHttpServer())
      .put(`/carteras/${carteraId}/cartera-config`)
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
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-DET-1" });
    await propietarioRepo.delete({ codigo: "SC-DET-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /carteras/:id/resumen devuelve el resumen con caja y totales", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/resumen`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.carteraId).toBe(carteraId);
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

  it("GET /carteras/:id/resumen con cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/999999/resumen`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /carteras/:id/resumen sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraId}/resumen`);

    expect(res.status).toBe(401);
  });

  it("un propietario SIN ver_reportes no puede ver el resumen -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-det-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-det-2@correo.com",
      telefono: "+59171160078",
      codigo: "SC-DET-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-det-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/resumen`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});