import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { AppModule } from "../../src/app.module";

describe("Logout y revocación de refresh token (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;

  const ADMIN_USERNAME = "logout-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Logout2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "logout-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "logout-e2e-refresh-secret";
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
      nombre: "Admin",
      apellido: "E2E",
      correo: null,
      telefono: null,
    });
  });

  afterAll(async () => {
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("revoca el refresh token y lo rechaza al reintentar refresh", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect(login.status).toBe(201);
    const refreshToken = login.body.refreshToken as string;

    const refreshAntes = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken });
    expect(refreshAntes.status).toBe(201);

    const logout = await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ refreshToken });
    expect(logout.status).toBe(204);

    const refreshDespues = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken });
    expect(refreshDespues.status).toBe(401);
  });

  it("es idempotente: revocar dos veces el mismo token no falla", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    const refreshToken = login.body.refreshToken as string;

    const primero = await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ refreshToken });
    const segundo = await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ refreshToken });

    expect(primero.status).toBe(204);
    expect(segundo.status).toBe(204);
  });
});
