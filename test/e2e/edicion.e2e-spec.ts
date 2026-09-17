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

describe("Edición de propietario y gestor (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let accessToken: string;
  let propietarioId: number;
  let propietario2Id: number;
  let gestorId: number;

  const ADMIN_USERNAME = "edicion-e2e-admin";
  const ADMIN_PASSWORD = "edicion-e2e-password";

  beforeAll(async () => {
    process.env.JWT_SECRET = "edicion-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "edicion-e2e-refresh-secret";
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

    const propietario = await propietarioRepo.save({
      usuario: "propietario-ed-1",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Juan",
      apellido: "Pérez",
      correo: "propietario-ed1@correo.com",
      telefono: "+59172222221",
      codigo: "SC-ED-001",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioId = propietario.id;

    const propietario2 = await propietarioRepo.save({
      usuario: "propietario-ed-2",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "María",
      apellido: "Gómez",
      correo: "propietario-ed2@correo.com",
      telefono: "+59172222222",
      codigo: "SC-ED-002",
      moneda: "BOB",
      estatus: "activo",
    });
    propietario2Id = propietario2.id;

    const gestor = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        propietarioId,
        usuario: "gestor-ed",
        password: "password-seguro",
        nombre: "Carlos",
        apellido: "López",
        correo: "gestor-ed@correo.com",
        telefono: "+59173333333",
        codigo: "CB-ED-001",
      });
    gestorId = gestor.body.id as number;
  });

  afterAll(async () => {
    await gestorRepo.delete({ id: gestorId });
    await propietarioRepo.delete({ id: propietarioId });
    await propietarioRepo.delete({ id: propietario2Id });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("PATCH /propietarios/:id -> 200 actualiza perfil sin passwordHash", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombre: "Juan Carlos", apellido: "Pérez Soto" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Juan Carlos");
    expect(res.body.apellido).toBe("Pérez Soto");
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  it("PATCH /propietarios/:id con nueva contraseña -> 200 sin exponer hash y con hash persistido", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: "nueva-password" });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).not.toContain("passwordHash");

    const persisted = await propietarioRepo
      .createQueryBuilder("s")
      .addSelect("s.passwordHash")
      .where("s.id = :id", { id: propietarioId })
      .getOne();
    expect(persisted).toBeDefined();
    expect(await bcrypt.compare("nueva-password", persisted!.passwordHash)).toBe(true);
  });

  it("PATCH /propietarios/:id con correo de otro propietario -> 409", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ correo: "propietario-ed2@correo.com" });

    expect(res.status).toBe(409);
  });

  it("PATCH /propietarios/:id con campo no editable -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ usuario: "nuevo-usuario" });

    expect(res.status).toBe(400);
  });

  it("PATCH /propietarios/:id con body vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("PATCH /propietarios/:id inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/999999`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(404);
  });

  it("PATCH /gestores/:id -> 200 actualiza sin passwordHash", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestores/${gestorId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombre: "Carlos Eduardo" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Carlos Eduardo");
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  it("PATCH /gestores/:id inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestores/999999`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(404);
  });

  it("PATCH /propietarios/:id sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(401);
  });
});
