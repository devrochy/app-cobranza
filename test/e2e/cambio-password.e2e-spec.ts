import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { AppModule } from "../../src/app.module";

describe("Cambio de contraseña (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let accessToken: string;

  const ADMIN_USERNAME = "cambiopass-e2e-admin";
  const PASSWORD = "Clave#Vieja2026";
  const NEW_PASSWORD = "Clave#Nueva2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "cambiopass-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "cambiopass-e2e-refresh-secret";
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
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await adminRepo.save({
      usuario: ADMIN_USERNAME,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      estado: "activo",
      nombre: "Admin",
      apellido: "E2E",
      correo: null,
      telefono: null,
    });

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: PASSWORD });
    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("cambia la contraseña con la actual correcta y permite login con la nueva", async () => {
    const res = await request(app.getHttpServer())
      .patch("/perfil/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ passwordActual: PASSWORD, passwordNueva: NEW_PASSWORD });

    expect(res.status).toBe(204);

    const loginNueva = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: NEW_PASSWORD });
    expect(loginNueva.status).toBe(201);

    const loginVieja = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: PASSWORD });
    expect(loginVieja.status).toBe(401);
  });

  it("rechaza con 400 si la contraseña actual es incorrecta", async () => {
    const res = await request(app.getHttpServer())
      .patch("/perfil/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ passwordActual: "incorrecta", passwordNueva: "Otra#Clave2026" });

    expect(res.status).toBe(400);
  });

  it("rechaza una contraseña nueva muy corta (min 8)", async () => {
    const res = await request(app.getHttpServer())
      .patch("/perfil/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ passwordActual: "cualquiera", passwordNueva: "corta" });

    expect(res.status).toBe(400);
  });

  it("sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch("/perfil/password")
      .send({ passwordActual: NEW_PASSWORD, passwordNueva: "Otra#Clave2026" });

    expect(res.status).toBe(401);
  });
});
