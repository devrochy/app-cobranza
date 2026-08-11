import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { AppModule } from "../../src/app.module";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;

  const ADMIN_USERNAME = "e2e-admin";
  const ADMIN_PASSWORD = "e2e-password";

  beforeAll(async () => {
    process.env.JWT_SECRET = "e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "e2e-refresh-secret";
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
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 4),
      estado: "activo",
      nombre: "E2E",
      apellido: "Admin",
      correo: null,
      telefono: null,
    });
  });

  afterAll(async () => {
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /auth/login -> 201 con access y refresh token", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.admin.usuario).toBe(ADMIN_USERNAME);
    expect(res.body.admin.passwordHash).toBeUndefined();
  });

  it("POST /auth/login con contraseña incorrecta -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("POST /auth/login sin password -> 400 (validación de DTO)", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME });

    expect(res.status).toBe(400);
  });

  it("POST /auth/refresh rota el par de tokens", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    const refreshToken = login.body.refreshToken as string;

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("GET /auth/me con access token -> 200 con identidad", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(Number), usuario: ADMIN_USERNAME });
  });

  it("GET /auth/me sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/auth/me");

    expect(res.status).toBe(401);
  });
});
