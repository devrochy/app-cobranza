import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { PROPIETARIO_PERMISOS } from "../../src/modules/propietarios/propietario-permiso.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Matriz de permisos por propietario (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let accessToken: string;
  let propietarioId: number;

  const ADMIN_USERNAME = "permisos-e2e-admin";
  const ADMIN_PASSWORD = "permisos-e2e-password";

  beforeAll(async () => {
    process.env.JWT_SECRET = "permisos-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "permisos-e2e-refresh-secret";
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

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    accessToken = login.body.accessToken as string;

    const propietario = await propietarioRepo.save({
      usuario: "propietario-pr-1",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Juan",
      apellido: "Pérez",
      correo: "propietario-pr@correo.com",
      telefono: "+59176666661",
      codigo: "SC-PR-001",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioId = propietario.id;
  });

  afterAll(async () => {
    await propietarioRepo.delete({ id: propietarioId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /propietarios/:id/permisos -> 200 con los 20 permisos en false por defecto", async () => {
    const res = await request(app.getHttpServer())
      .get(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(PROPIETARIO_PERMISOS.length);
    expect(res.body.every((p: { habilitado: boolean }) => p.habilitado === false)).toBe(true);
  });

  it("PUT /propietarios/:id/permisos habilita permisos y GET lo refleja", async () => {
    const put = await request(app.getHttpServer())
      .put(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { ver_reportes: true, registrar_gestor: true } });

    expect(put.status).toBe(200);
    expect(put.body.find((p: { permiso: string }) => p.permiso === "ver_reportes")?.habilitado).toBe(true);
    expect(put.body.find((p: { permiso: string }) => p.permiso === "eliminar_carteras")?.habilitado).toBe(false);

    const get = await request(app.getHttpServer())
      .get(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(get.status).toBe(200);
    expect(get.body.find((p: { permiso: string }) => p.permiso === "ver_reportes")?.habilitado).toBe(true);
    expect(get.body.find((p: { permiso: string }) => p.permiso === "registrar_gestor")?.habilitado).toBe(true);
  });

  it("PUT /propietarios/:id/permisos reemplaza la matriz (permisos ausentes vuelven a false)", async () => {
    const put = await request(app.getHttpServer())
      .put(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { eliminar_carteras: true, ver_reportes: false } });

    expect(put.status).toBe(200);
    expect(put.body.find((p: { permiso: string }) => p.permiso === "eliminar_carteras")?.habilitado).toBe(true);
    expect(put.body.find((p: { permiso: string }) => p.permiso === "ver_reportes")?.habilitado).toBe(false);
  });

  it("PUT /propietarios/:id/permisos con matriz vacía -> 200 deshabilita todo", async () => {
    const put = await request(app.getHttpServer())
      .put(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: {} });

    expect(put.status).toBe(200);
    expect(put.body.every((p: { habilitado: boolean }) => p.habilitado === false)).toBe(true);
  });

  it("PUT /propietarios/:id/permisos con permiso inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { permiso_inventado: true } });

    expect(res.status).toBe(400);
  });

  it("PUT /propietarios/:id/permisos con valor no booleano -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { ver_reportes: "true" } });

    expect(res.status).toBe(400);
  });

  it("PUT /propietarios/:id/permisos con matriz como array -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: ["ver_reportes"] });

    expect(res.status).toBe(400);
  });

  it("GET /propietarios/:id/permisos de un propietario inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/propietarios/999999/permisos`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it("GET /propietarios/:id/permisos sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/propietarios/${propietarioId}/permisos`);

    expect(res.status).toBe(401);
  });
});
