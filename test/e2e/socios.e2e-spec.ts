import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Socios (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let accessToken: string;

  const ADMIN_USERNAME = "socios-e2e-admin";
  const ADMIN_PASSWORD = "socios-e2e-password";

  const socioPayload = {
    usuario: "socio-e2e",
    password: "password-seguro",
    nombre: "Juan",
    apellido: "Pérez",
    correo: "juan@correo.com",
    telefono: "+59170000001",
    codigo: "SC-E2E-001",
    moneda: "BOB",
    estatus: "activo",
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "socios-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "socios-e2e-refresh-secret";
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
  });

  afterAll(async () => {
    await socioRepo.delete({ codigo: "SC-E2E-001" });
    await socioRepo.delete({ codigo: "SC-E2E-002" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /socios con token -> 201 y sin passwordHash en la respuesta", async () => {
    const res = await request(app.getHttpServer())
      .post("/socios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(socioPayload);

    expect(res.status).toBe(201);
    expect(res.body.usuario).toBe("socio-e2e");
    expect(res.body.codigo).toBe("SC-E2E-001");
    expect(res.body.moneda).toBe("BOB");
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  it("POST /socios sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/socios")
      .send(socioPayload);

    expect(res.status).toBe(401);
  });

  it("POST /socios con payload inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/socios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...socioPayload,
        password: "corta",
        moneda: "peso",
        correo: "correo-invalido",
        telefono: "123",
      });

    expect(res.status).toBe(400);
  });

  it("POST /socios con estatus inválido, campos vacíos o moneda en minúsculas -> 400", async () => {
    const casos = [
      { ...socioPayload, usuario: "socio-e2e-x1", estatus: "pendiente" },
      { ...socioPayload, usuario: "socio-e2e-x2", nombre: "", apellido: "", codigo: "" },
      { ...socioPayload, usuario: "socio-e2e-x3", moneda: "bob" },
    ];

    for (const payload of casos) {
      const res = await request(app.getHttpServer())
        .post("/socios")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload);

      expect(res.status).toBe(400);
    }
  });

  it("POST /socios sin estatus -> 201 con estatus activo por defecto", async () => {
    const sinEstatus = {
      usuario: "socio-e2e-2",
      password: "password-seguro",
      nombre: "María",
      apellido: "Gómez",
      correo: "maria@correo.com",
      telefono: "+59170000002",
      codigo: "SC-E2E-002",
      moneda: "BOB",
    };
    const res = await request(app.getHttpServer())
      .post("/socios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(sinEstatus);

    expect(res.status).toBe(201);
    expect(res.body.estatus).toBe("activo");
  });

  it("POST /socios duplicado -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post("/socios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(socioPayload);

    expect(res.status).toBe(409);
  });
});
