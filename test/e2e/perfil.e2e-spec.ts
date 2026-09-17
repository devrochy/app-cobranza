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

describe("Auto-actualización de perfil (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;

  const ADMIN_USUARIO = "perfil-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Perfil2026";
  const PROPIETARIO_USUARIO = "perfil-e2e-propietario";
  const GESTOR_USUARIO = "perfil-e2e-gestor";
  const PASSWORD = "Pass#Perfil2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-perfil";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-perfil";
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

    await gestorRepo.delete({ usuario: GESTOR_USUARIO });
    await propietarioRepo.delete({ usuario: PROPIETARIO_USUARIO });
    await adminRepo.delete({ usuario: ADMIN_USUARIO });

    await adminRepo.save({
      usuario: ADMIN_USUARIO,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 4),
      estado: "activo",
      nombre: "Admin",
      apellido: "E2E",
      correo: null,
      telefono: null,
    });

    const propietario = await propietarioRepo.save({
      usuario: PROPIETARIO_USUARIO,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "perfil-e2e-propietario@correo.com",
      telefono: "+59171160180",
      codigo: "SC-PERFIL-1",
      moneda: "BOB",
      estatus: "activo",
    });

    await gestorRepo.save({
      propietario: { id: propietario.id } as Propietario,
      usuario: GESTOR_USUARIO,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "perfil-e2e-gestor@correo.com",
      telefono: "+59171160181",
      codigo: "CB-PERFIL-1",
      estatus: "activo",
    });
  });

  afterAll(async () => {
    await gestorRepo.delete({ usuario: GESTOR_USUARIO });
    await propietarioRepo.delete({ usuario: PROPIETARIO_USUARIO });
    await adminRepo.delete({ usuario: ADMIN_USUARIO });
    await app.close();
  });

  async function tokenDe(
    rol: "gestor" | "propietario" | "admin",
  ): Promise<string> {
    const path =
      rol === "admin"
        ? "/auth/login"
        : rol === "propietario"
          ? "/auth/propietario/login"
          : "/auth/gestor/login";
    const usuario =
      rol === "admin" ? ADMIN_USUARIO : rol === "propietario" ? PROPIETARIO_USUARIO : GESTOR_USUARIO;
    const password = rol === "admin" ? ADMIN_PASSWORD : PASSWORD;
    const res = await request(app.getHttpServer())
      .post(path)
      .send({ usuario, password });
    return res.body.accessToken as string;
  }

  it("PATCH /perfil actualiza el perfil del gestor", async () => {
    const token = await tokenDe("gestor");

    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Nuevo", apellido: "Gestor" });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toBe(GESTOR_USUARIO);
    expect(res.body.nombre).toBe("Nuevo");
    expect(res.body.apellido).toBe("Gestor");

    const enDb = await gestorRepo.findOne({ where: { usuario: GESTOR_USUARIO } });
    expect(enDb?.nombre).toBe("Nuevo");
  });

  it("PATCH /perfil actualiza el perfil del propietario", async () => {
    const token = await tokenDe("propietario");

    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Ana", apellido: "Propietario" });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toBe(PROPIETARIO_USUARIO);
    expect(res.body.nombre).toBe("Ana");

    const enDb = await propietarioRepo.findOne({ where: { usuario: PROPIETARIO_USUARIO } });
    expect(enDb?.apellido).toBe("Propietario");
  });

  it("PATCH /perfil sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .send({ nombre: "x", apellido: "y" });

    expect(res.status).toBe(401);
  });

  it("PATCH /perfil sin nombre -> 400", async () => {
    const token = await tokenDe("gestor");

    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", `Bearer ${token}`)
      .send({ apellido: "solo-apellido" });

    expect(res.status).toBe(400);
  });

  it("PATCH /perfil actualiza el perfil del admin", async () => {
    const token = await tokenDe("admin");

    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Root", apellido: "Admin" });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toBe(ADMIN_USUARIO);
    expect(res.body.nombre).toBe("Root");
    expect(res.body.apellido).toBe("Admin");

    const enDb = await adminRepo.findOne({ where: { usuario: ADMIN_USUARIO } });
    expect(enDb?.apellido).toBe("Admin");
  });

  it("GET /perfil devuelve el perfil del usuario autenticado", async () => {
    const token = await tokenDe("gestor");

    const res = await request(app.getHttpServer())
      .get("/perfil")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.usuario).toBe(GESTOR_USUARIO);
    expect(res.body).toHaveProperty("nombre");
    expect(res.body).toHaveProperty("apellido");
  });

  it("GET /perfil sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/perfil");

    expect(res.status).toBe(401);
  });
});
