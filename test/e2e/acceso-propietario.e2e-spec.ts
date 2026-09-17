import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Acceso del propietario limitado a sus permisos (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let accessTokenAdmin: string;
  let accessTokenPropietarioA: string;
  let propietarioAId: number;
  let propietarioBId: number;

  const ADMIN_USERNAME = "acceso-e2e-admin";
  const ADMIN_PASSWORD = "acceso-e2e-password";
  const PROPIETARIO_PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario, password: PROPIETARIO_PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "acceso-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "acceso-e2e-refresh-secret";
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

    const propietarioA = await propietarioRepo.save({
      usuario: "propietario-ac-a",
      passwordHash: await bcrypt.hash(PROPIETARIO_PASSWORD, 4),
      nombre: "Ana",
      apellido: "Ruiz",
      correo: "propietario-ac-a@correo.com",
      telefono: "+59177777771",
      codigo: "SC-AC-A",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioAId = propietarioA.id;

    const propietarioB = await propietarioRepo.save({
      usuario: "propietario-ac-b",
      passwordHash: await bcrypt.hash(PROPIETARIO_PASSWORD, 4),
      nombre: "Luis",
      apellido: "Mora",
      correo: "propietario-ac-b@correo.com",
      telefono: "+59177777772",
      codigo: "SC-AC-B",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioBId = propietarioB.id;

    await request(app.getHttpServer())
      .put(`/propietarios/${propietarioAId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { registrar_propietario: true } });

    accessTokenPropietarioA = await loginPropietario("propietario-ac-a");
  });

  afterAll(async () => {
    await propietarioRepo.delete({ codigo: "SC-AC-CREATED" });
    await propietarioRepo.delete({ codigo: "SC-AC-Y" });
    await propietarioRepo.delete({ codigo: "SC-AC-X" });
    await propietarioRepo.delete({ id: propietarioAId });
    await propietarioRepo.delete({ id: propietarioBId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /auth/propietario/login -> 200 con token de rol propietario", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-ac-a", password: PROPIETARIO_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.propietario.usuario).toBe("propietario-ac-a");
    const payload = new JwtService().decode(res.body.accessToken as string) as Record<string, unknown>;
    expect(payload.rol).toBe("propietario");
  });

  it("un propietario con registrar_propietario puede crear un propietario", async () => {
    const res = await request(app.getHttpServer())
      .post("/propietarios")
      .set("Authorization", `Bearer ${accessTokenPropietarioA}`)
      .send({
        usuario: "propietario-ac-created",
        password: PROPIETARIO_PASSWORD,
        nombre: "Nuevo",
        apellido: "Propietario",
        correo: "propietario-ac-created@correo.com",
        telefono: "+59177777773",
        codigo: "SC-AC-CREATED",
        moneda: "BOB",
        estatus: "activo",
      });

    expect(res.status).toBe(201);
  });

  it("un propietario sin registrar_propietario recibe 403", async () => {
    const tokenPropietarioB = await loginPropietario("propietario-ac-b");

    const res = await request(app.getHttpServer())
      .post("/propietarios")
      .set("Authorization", `Bearer ${tokenPropietarioB}`)
      .send({
        usuario: "propietario-ac-x",
        password: PROPIETARIO_PASSWORD,
        nombre: "X",
        apellido: "Y",
        correo: "propietario-ac-x@correo.com",
        telefono: "+59177777774",
        codigo: "SC-AC-X",
        moneda: "BOB",
        estatus: "activo",
      });

    expect(res.status).toBe(403);
  });

  it("un propietario no puede usar carteras admin-only (PATCH /propietarios/:id) -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioAId}`)
      .set("Authorization", `Bearer ${accessTokenPropietarioA}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(403);
  });

  it("un propietario no puede consultar la matriz de permisos de propietarios (admin-only) -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/propietarios/${propietarioBId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenPropietarioA}`);

    expect(res.status).toBe(403);
  });

  it("un propietario no puede bloquear otro propietario (admin-only) -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioBId}/estatus`)
      .set("Authorization", `Bearer ${accessTokenPropietarioA}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(403);
  });

  it("un admin conserva acceso total (bypass)", async () => {
    const res = await request(app.getHttpServer())
      .post("/propietarios")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        usuario: "propietario-ac-y",
        password: PROPIETARIO_PASSWORD,
        nombre: "Y",
        apellido: "Z",
        correo: "propietario-ac-y@correo.com",
        telefono: "+59177777775",
        codigo: "SC-AC-Y",
        moneda: "BOB",
        estatus: "activo",
      });

    expect(res.status).toBe(201);
  });

  it("el refresh de un propietario devuelve un par nuevo con rol propietario", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-ac-a", password: PROPIETARIO_PASSWORD });

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });

    expect(res.status).toBe(201);
    const payload = new JwtService().decode(res.body.accessToken as string) as Record<string, unknown>;
    expect(payload.rol).toBe("propietario");
  });

  it("POST /auth/propietario/login de un propietario bloqueado -> 401", async () => {
    await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioBId}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "bloqueado" });

    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-ac-b", password: PROPIETARIO_PASSWORD });

    expect(res.status).toBe(401);
  });
});
