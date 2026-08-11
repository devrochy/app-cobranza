import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Cobradores (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let accessToken: string;
  let socioActivoId: number;
  let socioBloqueadoId: number;

  const ADMIN_USERNAME = "cobradores-e2e-admin";
  const ADMIN_PASSWORD = "cobradores-e2e-password";

  const cobradorPayload = {
    socioId: 0,
    usuario: "cobrador-e2e",
    password: "password-seguro",
    nombre: "Carlos",
    apellido: "López",
    correo: "carlos@correo.com",
    telefono: "+59171111111",
    codigo: "CB-E2E-001",
    estatus: "activo",
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "cobradores-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "cobradores-e2e-refresh-secret";
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
    accessToken = login.body.accessToken as string;

    const socioActivo = await socioRepo.save({
      usuario: "socio-e2e-activo",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Juan",
      apellido: "Pérez",
      correo: "activo@correo.com",
      telefono: "+59179999999",
      codigo: "SC-E2E-ACTIVO",
      moneda: "BOB",
      estatus: "activo",
    });
    socioActivoId = socioActivo.id;

    const socioBloqueado = await socioRepo.save({
      usuario: "socio-e2e-bloqueado",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Pedro",
      apellido: "Gómez",
      correo: "bloqueado@correo.com",
      telefono: "+59179999998",
      codigo: "SC-E2E-BLOQ",
      moneda: "BOB",
      estatus: "bloqueado",
    });
    socioBloqueadoId = socioBloqueado.id;
  });

  afterAll(async () => {
    await cobradorRepo.delete({ codigo: cobradorPayload.codigo });
    await socioRepo.delete({ id: socioActivoId });
    await socioRepo.delete({ id: socioBloqueadoId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /cobradores con token -> 201 con socioId y sin passwordHash", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...cobradorPayload, socioId: socioActivoId });

    expect(res.status).toBe(201);
    expect(res.body.usuario).toBe("cobrador-e2e");
    expect(res.body.socioId).toBe(socioActivoId);
    expect(res.body.estatus).toBe("activo");
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  it("POST /cobradores sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .send({ ...cobradorPayload, socioId: socioActivoId, codigo: "CB-E2E-999" });

    expect(res.status).toBe(401);
  });

  it("POST /cobradores con socio inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...cobradorPayload, socioId: 999999, codigo: "CB-E2E-002" });

    expect(res.status).toBe(404);
  });

  it("POST /cobradores con socio bloqueado -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...cobradorPayload, socioId: socioBloqueadoId, codigo: "CB-E2E-003" });

    expect(res.status).toBe(409);
  });

  it("POST /cobradores duplicado -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...cobradorPayload, socioId: socioActivoId });

    expect(res.status).toBe(409);
  });

  it("POST /cobradores con payload inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...cobradorPayload,
        socioId: "no-numero",
        password: "corta",
        correo: "correo-invalido",
        telefono: "123",
      });

    expect(res.status).toBe(400);
  });

  it("POST /cobradores con estatus inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...cobradorPayload, socioId: socioActivoId, codigo: "CB-E2E-004", estatus: "pendiente" });

    expect(res.status).toBe(400);
  });
});
