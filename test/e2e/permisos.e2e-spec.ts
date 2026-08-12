import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { SOCIO_PERMISOS } from "../../src/modules/socios/socio-permiso.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Matriz de permisos por socio (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let accessToken: string;
  let socioId: number;

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

    const socio = await socioRepo.save({
      usuario: "socio-pr-1",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Juan",
      apellido: "Pérez",
      correo: "socio-pr@correo.com",
      telefono: "+59176666661",
      codigo: "SC-PR-001",
      moneda: "BOB",
      estatus: "activo",
    });
    socioId = socio.id;
  });

  afterAll(async () => {
    await socioRepo.delete({ id: socioId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /socios/:id/permisos -> 200 con los 20 permisos en false por defecto", async () => {
    const res = await request(app.getHttpServer())
      .get(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(SOCIO_PERMISOS.length);
    expect(res.body.every((p: { habilitado: boolean }) => p.habilitado === false)).toBe(true);
  });

  it("PUT /socios/:id/permisos habilita permisos y GET lo refleja", async () => {
    const put = await request(app.getHttpServer())
      .put(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { ver_reportes: true, registrar_cobrador: true } });

    expect(put.status).toBe(200);
    expect(put.body.find((p: { permiso: string }) => p.permiso === "ver_reportes")?.habilitado).toBe(true);
    expect(put.body.find((p: { permiso: string }) => p.permiso === "eliminar_rutas")?.habilitado).toBe(false);

    const get = await request(app.getHttpServer())
      .get(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(get.status).toBe(200);
    expect(get.body.find((p: { permiso: string }) => p.permiso === "ver_reportes")?.habilitado).toBe(true);
    expect(get.body.find((p: { permiso: string }) => p.permiso === "registrar_cobrador")?.habilitado).toBe(true);
  });

  it("PUT /socios/:id/permisos reemplaza la matriz (permisos ausentes vuelven a false)", async () => {
    const put = await request(app.getHttpServer())
      .put(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { eliminar_rutas: true, ver_reportes: false } });

    expect(put.status).toBe(200);
    expect(put.body.find((p: { permiso: string }) => p.permiso === "eliminar_rutas")?.habilitado).toBe(true);
    expect(put.body.find((p: { permiso: string }) => p.permiso === "ver_reportes")?.habilitado).toBe(false);
  });

  it("PUT /socios/:id/permisos con matriz vacía -> 200 deshabilita todo", async () => {
    const put = await request(app.getHttpServer())
      .put(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: {} });

    expect(put.status).toBe(200);
    expect(put.body.every((p: { habilitado: boolean }) => p.habilitado === false)).toBe(true);
  });

  it("PUT /socios/:id/permisos con permiso inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { permiso_inventado: true } });

    expect(res.status).toBe(400);
  });

  it("PUT /socios/:id/permisos con valor no booleano -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { ver_reportes: "true" } });

    expect(res.status).toBe(400);
  });

  it("PUT /socios/:id/permisos con matriz como array -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: ["ver_reportes"] });

    expect(res.status).toBe(400);
  });

  it("GET /socios/:id/permisos de un socio inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/socios/999999/permisos`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it("GET /socios/:id/permisos sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/socios/${socioId}/permisos`);

    expect(res.status).toBe(401);
  });
});
