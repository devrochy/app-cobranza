import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { GESTOR_PERMISOS } from "../../src/modules/gestores/gestor-permiso.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Matriz de permisos de gestor gestionada por el propietario (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let accessTokenAdmin: string;
  let tokenPropietario1: string;
  let tokenPropietario2: string;
  let propietario1Id: number;
  let propietario2Id: number;
  let gestor1Id: number;
  let gestor2Id: number;

  const ADMIN_USERNAME = "cp-e2e-admin";
  const ADMIN_PASSWORD = "cp-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "cp-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "cp-e2e-refresh-secret";
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

    await gestorRepo.delete({ codigo: "CB-CP-X" });
    await gestorRepo.delete({ codigo: "CB-CP-Y" });
    await gestorRepo.delete({ codigo: "CB-CP-1" });
    await gestorRepo.delete({ codigo: "CB-CP-2" });
    await propietarioRepo.delete({ codigo: "SC-CP-1" });
    await propietarioRepo.delete({ codigo: "SC-CP-2" });
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

    const propietario1 = await propietarioRepo.save({
      usuario: "propietario-cp-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Ruiz",
      correo: "propietario-cp-1@correo.com",
      telefono: "+59178888881",
      codigo: "SC-CP-1",
      moneda: "BOB",
      estatus: "activo",
    });
    propietario1Id = propietario1.id;

    const propietario2 = await propietarioRepo.save({
      usuario: "propietario-cp-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Luis",
      apellido: "Mora",
      correo: "propietario-cp-2@correo.com",
      telefono: "+59178888882",
      codigo: "SC-CP-2",
      moneda: "BOB",
      estatus: "activo",
    });
    propietario2Id = propietario2.id;

    await request(app.getHttpServer())
      .put(`/propietarios/${propietario1Id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        matriz: {
          ver_reportes: true,
          editar_permisos: true,
          registrar_gestor: true,
        },
      });

    const gestor1 = await gestorRepo.save({
      propietario: { id: propietario1Id },
      usuario: "gestor-cp-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "López",
      correo: "gestor-cp-1@correo.com",
      telefono: "+59179998881",
      codigo: "CB-CP-1",
      estatus: "activo",
    });
    gestor1Id = gestor1.id;

    const gestor2 = await gestorRepo.save({
      propietario: { id: propietario2Id },
      usuario: "gestor-cp-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Pedro",
      apellido: "Gómez",
      correo: "gestor-cp-2@correo.com",
      telefono: "+59179998882",
      codigo: "CB-CP-2",
      estatus: "activo",
    });
    gestor2Id = gestor2.id;

    tokenPropietario1 = await loginPropietario("propietario-cp-1");
    tokenPropietario2 = await loginPropietario("propietario-cp-2");
  });

  afterAll(async () => {
    await gestorRepo.delete({ codigo: "CB-CP-X" });
    await gestorRepo.delete({ codigo: "CB-CP-Y" });
    await gestorRepo.delete({ id: gestor1Id });
    await gestorRepo.delete({ id: gestor2Id });
    await propietarioRepo.delete({ id: propietario1Id });
    await propietarioRepo.delete({ id: propietario2Id });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /gestores como admin devuelve todos", async () => {
    const res = await request(app.getHttpServer())
      .get("/gestores")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const codigos = res.body.map((c: { codigo: string }) => c.codigo);
    expect(codigos).toContain("CB-CP-1");
    expect(codigos).toContain("CB-CP-2");
  });

  it("GET /gestores como propietario con ver_reportes devuelve solo sus colaboradores", async () => {
    const res = await request(app.getHttpServer())
      .get("/gestores")
      .set("Authorization", `Bearer ${tokenPropietario1}`);

    expect(res.status).toBe(200);
    const codigos = res.body.map((c: { codigo: string }) => c.codigo);
    expect(codigos).toContain("CB-CP-1");
    expect(codigos).not.toContain("CB-CP-2");
  });

  it("GET /gestores/:id/permisos de un gestor propio -> 200 con los 12 permisos", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestores/${gestor1Id}/permisos`)
      .set("Authorization", `Bearer ${tokenPropietario1}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(GESTOR_PERMISOS.length);
    expect(res.body.every((p: { habilitado: boolean }) => p.habilitado === false)).toBe(true);
  });

  it("PUT /gestores/:id/permisos de un gestor propio -> 200", async () => {
    const res = await request(app.getHttpServer())
      .put(`/gestores/${gestor1Id}/permisos`)
      .set("Authorization", `Bearer ${tokenPropietario1}`)
      .send({ matriz: { registrar_pago: true } });

    expect(res.status).toBe(200);
    expect(res.body.find((p: { permiso: string }) => p.permiso === "registrar_pago")?.habilitado).toBe(true);
  });

  it("GET /gestores/:id/permisos de un gestor ajeno -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestores/${gestor2Id}/permisos`)
      .set("Authorization", `Bearer ${tokenPropietario1}`);

    expect(res.status).toBe(403);
  });

  it("PUT /gestores/:id/permisos de un gestor ajeno -> 403", async () => {
    const res = await request(app.getHttpServer())
      .put(`/gestores/${gestor2Id}/permisos`)
      .set("Authorization", `Bearer ${tokenPropietario1}`)
      .send({ matriz: { registrar_pago: true } });

    expect(res.status).toBe(403);
  });

  it("un propietario no puede crear un gestor bajo otro propietarioId -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${tokenPropietario1}`)
      .send({
        propietarioId: propietario2Id,
        usuario: "gestor-cp-x",
        password: PASSWORD,
        nombre: "X",
        apellido: "Y",
        correo: "gestor-cp-x@correo.com",
        telefono: "+59179998883",
        codigo: "CB-CP-X",
      });

    expect(res.status).toBe(403);
  });

  it("un propietario puede crear un gestor bajo su propio propietarioId -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${tokenPropietario1}`)
      .send({
        propietarioId: propietario1Id,
        usuario: "gestor-cp-y",
        password: PASSWORD,
        nombre: "Y",
        apellido: "Z",
        correo: "gestor-cp-y@correo.com",
        telefono: "+59179998884",
        codigo: "CB-CP-Y",
      });

    expect(res.status).toBe(201);
  });

  it("un propietario no puede bloquear un gestor ajeno -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestores/${gestor2Id}/estatus`)
      .set("Authorization", `Bearer ${tokenPropietario1}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(403);
  });

  it("GET /gestores como propietario SIN ver_reportes -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get("/gestores")
      .set("Authorization", `Bearer ${tokenPropietario2}`);

    expect(res.status).toBe(403);
  });

  it("GET /gestores sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/gestores");

    expect(res.status).toBe(401);
  });
});
