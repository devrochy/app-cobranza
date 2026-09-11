import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { AppModule } from "../../src/app.module";

describe("Seguridad de auth (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;

  const ADMIN_USERNAME = "seg-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Seg2026";

  beforeAll(async () => {
    process.env.AUTH_THROTTLE_LIMIT = "2";
    process.env.AUTH_THROTTLE_TTL_MS = "60000";
    process.env.JWT_SECRET = "seg-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "seg-e2e-refresh-secret";
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

  const login = () =>
    request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });

  it("limita los intentos de login por IP (429 al exceder)", async () => {
    const primero = await login();
    const segundo = await login();
    const tercero = await login();

    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(201);
    expect(tercero.status).toBe(429);
  });
});
