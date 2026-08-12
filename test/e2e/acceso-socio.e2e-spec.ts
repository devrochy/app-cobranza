import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Acceso del socio limitado a sus permisos (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let accessTokenAdmin: string;
  let accessTokenSocioA: string;
  let socioAId: number;
  let socioBId: number;

  const ADMIN_USERNAME = "acceso-e2e-admin";
  const ADMIN_PASSWORD = "acceso-e2e-password";
  const SOCIO_PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario, password: SOCIO_PASSWORD });
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

    const adminLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    accessTokenAdmin = adminLogin.body.accessToken as string;

    const socioA = await socioRepo.save({
      usuario: "socio-ac-a",
      passwordHash: await bcrypt.hash(SOCIO_PASSWORD, 4),
      nombre: "Ana",
      apellido: "Ruiz",
      correo: "socio-ac-a@correo.com",
      telefono: "+59177777771",
      codigo: "SC-AC-A",
      moneda: "BOB",
      estatus: "activo",
    });
    socioAId = socioA.id;

    const socioB = await socioRepo.save({
      usuario: "socio-ac-b",
      passwordHash: await bcrypt.hash(SOCIO_PASSWORD, 4),
      nombre: "Luis",
      apellido: "Mora",
      correo: "socio-ac-b@correo.com",
      telefono: "+59177777772",
      codigo: "SC-AC-B",
      moneda: "BOB",
      estatus: "activo",
    });
    socioBId = socioB.id;

    await request(app.getHttpServer())
      .put(`/socios/${socioAId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { registrar_socio: true } });

    accessTokenSocioA = await loginSocio("socio-ac-a");
  });

  afterAll(async () => {
    await socioRepo.delete({ codigo: "SC-AC-CREATED" });
    await socioRepo.delete({ codigo: "SC-AC-Y" });
    await socioRepo.delete({ codigo: "SC-AC-X" });
    await socioRepo.delete({ id: socioAId });
    await socioRepo.delete({ id: socioBId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /auth/socio/login -> 200 con token de rol socio", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-ac-a", password: SOCIO_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.socio.usuario).toBe("socio-ac-a");
    const payload = new JwtService().decode(res.body.accessToken as string) as Record<string, unknown>;
    expect(payload.rol).toBe("socio");
  });

  it("un socio con registrar_socio puede crear un socio", async () => {
    const res = await request(app.getHttpServer())
      .post("/socios")
      .set("Authorization", `Bearer ${accessTokenSocioA}`)
      .send({
        usuario: "socio-ac-created",
        password: SOCIO_PASSWORD,
        nombre: "Nuevo",
        apellido: "Socio",
        correo: "socio-ac-created@correo.com",
        telefono: "+59177777773",
        codigo: "SC-AC-CREATED",
        moneda: "BOB",
        estatus: "activo",
      });

    expect(res.status).toBe(201);
  });

  it("un socio sin registrar_socio recibe 403", async () => {
    const tokenSocioB = await loginSocio("socio-ac-b");

    const res = await request(app.getHttpServer())
      .post("/socios")
      .set("Authorization", `Bearer ${tokenSocioB}`)
      .send({
        usuario: "socio-ac-x",
        password: SOCIO_PASSWORD,
        nombre: "X",
        apellido: "Y",
        correo: "socio-ac-x@correo.com",
        telefono: "+59177777774",
        codigo: "SC-AC-X",
        moneda: "BOB",
        estatus: "activo",
      });

    expect(res.status).toBe(403);
  });

  it("un socio no puede usar rutas admin-only (PATCH /socios/:id) -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioAId}`)
      .set("Authorization", `Bearer ${accessTokenSocioA}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(403);
  });

  it("un socio no puede consultar la matriz de permisos de socios (admin-only) -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/socios/${socioBId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenSocioA}`);

    expect(res.status).toBe(403);
  });

  it("un socio no puede bloquear otro socio (admin-only) -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioBId}/estatus`)
      .set("Authorization", `Bearer ${accessTokenSocioA}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(403);
  });

  it("un admin conserva acceso total (bypass)", async () => {
    const res = await request(app.getHttpServer())
      .post("/socios")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        usuario: "socio-ac-y",
        password: SOCIO_PASSWORD,
        nombre: "Y",
        apellido: "Z",
        correo: "socio-ac-y@correo.com",
        telefono: "+59177777775",
        codigo: "SC-AC-Y",
        moneda: "BOB",
        estatus: "activo",
      });

    expect(res.status).toBe(201);
  });

  it("el refresh de un socio devuelve un par nuevo con rol socio", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-ac-a", password: SOCIO_PASSWORD });

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });

    expect(res.status).toBe(201);
    const payload = new JwtService().decode(res.body.accessToken as string) as Record<string, unknown>;
    expect(payload.rol).toBe("socio");
  });

  it("POST /auth/socio/login de un socio bloqueado -> 401", async () => {
    await request(app.getHttpServer())
      .patch(`/socios/${socioBId}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "bloqueado" });

    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-ac-b", password: SOCIO_PASSWORD });

    expect(res.status).toBe(401);
  });
});
