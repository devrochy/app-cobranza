import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Gestores (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let accessToken: string;
  let propietarioActivoId: number;
  let propietarioBloqueadoId: number;

  const ADMIN_USERNAME = "gestores-e2e-admin";
  const ADMIN_PASSWORD = "gestores-e2e-password";

  const gestorPayload = {
    propietarioId: 0,
    usuario: "gestor-e2e",
    password: "password-seguro",
    nombre: "Carlos",
    apellido: "López",
    correo: "carlos@correo.com",
    telefono: "+59171111111",
    codigo: "CB-E2E-001",
    estatus: "activo",
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "gestores-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "gestores-e2e-refresh-secret";
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

    const propietarioActivo = await propietarioRepo.save({
      usuario: "propietario-e2e-activo",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Juan",
      apellido: "Pérez",
      correo: "activo@correo.com",
      telefono: "+59179999999",
      codigo: "SC-E2E-ACTIVO",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioActivoId = propietarioActivo.id;

    const propietarioBloqueado = await propietarioRepo.save({
      usuario: "propietario-e2e-bloqueado",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Pedro",
      apellido: "Gómez",
      correo: "bloqueado@correo.com",
      telefono: "+59179999998",
      codigo: "SC-E2E-BLOQ",
      moneda: "BOB",
      estatus: "bloqueado",
    });
    propietarioBloqueadoId = propietarioBloqueado.id;
  });

  afterAll(async () => {
    await gestorRepo.delete({ codigo: gestorPayload.codigo });
    await propietarioRepo.delete({ id: propietarioActivoId });
    await propietarioRepo.delete({ id: propietarioBloqueadoId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /gestores con token -> 201 con propietarioId y sin passwordHash", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...gestorPayload, propietarioId: propietarioActivoId });

    expect(res.status).toBe(201);
    expect(res.body.usuario).toBe("gestor-e2e");
    expect(res.body.propietarioId).toBe(propietarioActivoId);
    expect(res.body.estatus).toBe("activo");
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  it("POST /gestores sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .send({ ...gestorPayload, propietarioId: propietarioActivoId, codigo: "CB-E2E-999" });

    expect(res.status).toBe(401);
  });

  it("POST /gestores con propietario inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...gestorPayload, propietarioId: 999999, codigo: "CB-E2E-002" });

    expect(res.status).toBe(404);
  });

  it("POST /gestores con propietario bloqueado -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...gestorPayload, propietarioId: propietarioBloqueadoId, codigo: "CB-E2E-003" });

    expect(res.status).toBe(409);
  });

  it("POST /gestores duplicado -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...gestorPayload, propietarioId: propietarioActivoId });

    expect(res.status).toBe(409);
  });

  it("POST /gestores con payload inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...gestorPayload,
        propietarioId: "no-numero",
        password: "corta",
        correo: "correo-invalido",
        telefono: "123",
      });

    expect(res.status).toBe(400);
  });

  it("POST /gestores con estatus inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...gestorPayload, propietarioId: propietarioActivoId, codigo: "CB-E2E-004", estatus: "pendiente" });

    expect(res.status).toBe(400);
  });
});
