import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { ReglaNegociacionIa } from "../../src/modules/reglas-negociacion-ia/regla-negociacion-ia.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Configuración de reglas de negociación de la IA (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let reglasRepo: Repository<ReglaNegociacionIa>;
  let accessTokenAdmin: string;

  const ADMIN_USERNAME = "reglas-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Reglas2026";
  const PASSWORD = "Propietario#Reglas2026";

  const VALORES = {
    maxDiasProrroga: 5,
    minAbonoAceptablePct: 25,
    maxReprogramacionesPorCliente: 2,
    umbralSaldoAutonomo: 500,
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-reglas";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-reglas";
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
    reglasRepo = moduleFixture.get(getRepositoryToken(ReglaNegociacionIa));

    await reglasRepo.createQueryBuilder().delete().execute();
    await propietarioRepo.delete({ codigo: "SC-REGLAS-1" });
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

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    accessTokenAdmin = login.body.accessToken as string;
  });

  afterAll(async () => {
    await reglasRepo.createQueryBuilder().delete().execute();
    await propietarioRepo.delete({ codigo: "SC-REGLAS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /reglas-negociacion-ia devuelve defaults cuando no hay configuración", async () => {
    const res = await request(app.getHttpServer())
      .get("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.maxDiasProrroga).toBe(0);
    expect(res.body.minAbonoAceptablePct).toBe(0);
    expect(res.body.configuradoPor).toBeNull();
  });

  it("PUT /reglas-negociacion-ia guarda la configuración", async () => {
    const res = await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(VALORES);

    expect(res.status).toBe(200);
    expect(res.body.maxDiasProrroga).toBe(5);
    expect(res.body.umbralSaldoAutonomo).toBe(500);
    expect(res.body.configuradoPor).toBeDefined();
  });

  it("GET devuelve la configuración persistida tras guardar", async () => {
    // Autocontenido: no depende de que otro test haya guardado antes.
    await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(VALORES)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.maxDiasProrroga).toBe(5);
    expect(res.body.minAbonoAceptablePct).toBe(25);
    expect(res.body.maxReprogramacionesPorCliente).toBe(2);
  });

  it("PUT sobrescribe (upsert) la fila única", async () => {
    const res = await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...VALORES, maxDiasProrroga: 9 });

    expect(res.status).toBe(200);
    expect(res.body.maxDiasProrroga).toBe(9);

    const filas = await reglasRepo.find();
    expect(filas).toHaveLength(1);
  });

  it("PUT con minAbonoAceptablePct > 100 -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...VALORES, minAbonoAceptablePct: 150 });

    expect(res.status).toBe(400);
  });

  it("PUT con minAbonoAceptablePct negativo -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...VALORES, minAbonoAceptablePct: -5 });

    expect(res.status).toBe(400);
  });

  it("PUT sin un campo obligatorio -> 400", async () => {
    const incompleto = { ...VALORES };
    delete (incompleto as Partial<typeof VALORES>).maxDiasProrroga;
    const res = await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(incompleto);

    expect(res.status).toBe(400);
  });

  it("GET sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/reglas-negociacion-ia");

    expect(res.status).toBe(401);
  });

  it("un propietario no puede acceder al endpoint (admin-only) -> 403", async () => {
    await propietarioRepo.save({
      usuario: "propietario-reglas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-reglas-1@correo.com",
      telefono: "+59171160170",
      codigo: "SC-REGLAS-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-reglas-1", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const resGet = await request(app.getHttpServer())
      .get("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(resGet.status).toBe(403);

    const resPut = await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send(VALORES);

    expect(resPut.status).toBe(403);
  });
});
