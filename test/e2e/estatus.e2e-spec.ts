import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Bloqueo/activación de propietario y gestor (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let accessToken: string;
  let propietarioId: number;
  let gestorId: number;
  let carteraId: number;

  const ADMIN_USERNAME = "estatus-e2e-admin";
  const ADMIN_PASSWORD = "estatus-e2e-password";

  beforeAll(async () => {
    process.env.JWT_SECRET = "estatus-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "estatus-e2e-refresh-secret";
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
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));

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
      usuario: "propietario-es-1",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Juan",
      apellido: "Pérez",
      correo: "propietario-es1@correo.com",
      telefono: "+59174444441",
      codigo: "SC-ES-001",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioId = propietario.id;

    const gestor = await request(app.getHttpServer())
      .post("/gestores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        propietarioId,
        usuario: "gestor-es",
        password: "password-seguro",
        nombre: "Carlos",
        apellido: "López",
        correo: "gestor-es@correo.com",
        telefono: "+59175555555",
        codigo: "CB-ES-001",
      });
    gestorId = gestor.body.id as number;

    const cartera = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        nombre: "Cartera ESTATUS",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 0,
        costoCobro: 100,
      });
    carteraId = cartera.body.id as number;
  });

  afterAll(async () => {
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ id: gestorId });
    await propietarioRepo.delete({ id: propietarioId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("PATCH /propietarios/:id/estatus -> 200 bloquea sin passwordHash y conserva el hash de la contraseña", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("bloqueado");
    expect(Object.keys(res.body)).not.toContain("passwordHash");

    const persisted = await propietarioRepo
      .createQueryBuilder("s")
      .addSelect("s.passwordHash")
      .where("s.id = :id", { id: propietarioId })
      .getOne();
    expect(persisted).toBeDefined();
    expect(await bcrypt.compare("password-seguro", persisted!.passwordHash)).toBe(true);
  });

  it("PATCH /propietarios/:id/estatus -> 200 reactiva", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "activo" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("activo");
  });

  it("bloquear el propietario aplica la cascada a gestores y carteras; reactivar la revierte", async () => {
    await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" })
      .expect(200);

    expect((await gestorRepo.findOne({ where: { id: gestorId } }))?.estatus).toBe("bloqueado");
    expect((await carteraRepo.findOne({ where: { id: carteraId } }))?.estatus).toBe("bloqueado");

    await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "activo" })
      .expect(200);

    expect((await gestorRepo.findOne({ where: { id: gestorId } }))?.estatus).toBe("activo");
    expect((await carteraRepo.findOne({ where: { id: carteraId } }))?.estatus).toBe("activo");
  });

  it("PATCH /propietarios/:id/estatus es idempotente (dos PATCH con el mismo estatus)", async () => {
    const primero = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });
    const segundo = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(primero.status).toBe(200);
    expect(segundo.status).toBe(200);
    expect(segundo.body.estatus).toBe("bloqueado");
  });

  it("PATCH /propietarios/:id/estatus con estatus inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "pendiente" });

    expect(res.status).toBe(400);
  });

  it("PATCH /propietarios/:id/estatus inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/999999/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(404);
  });

  it("PATCH /propietarios/:id/estatus sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietarioId}/estatus`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(401);
  });

  it("PATCH /gestores/:id/estatus -> 200 bloquea sin passwordHash y conserva el hash", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestores/${gestorId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("bloqueado");
    expect(Object.keys(res.body)).not.toContain("passwordHash");

    const persisted = await gestorRepo
      .createQueryBuilder("c")
      .addSelect("c.passwordHash")
      .where("c.id = :id", { id: gestorId })
      .getOne();
    expect(persisted).toBeDefined();
    expect(await bcrypt.compare("password-seguro", persisted!.passwordHash)).toBe(true);
  });

  it("PATCH /gestores/:id/estatus -> 200 reactiva", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestores/${gestorId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "activo" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("activo");
  });

  it("PATCH /gestores/:id/estatus con estatus inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestores/${gestorId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "pendiente" });

    expect(res.status).toBe(400);
  });

  it("PATCH /gestores/:id/estatus sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestores/${gestorId}/estatus`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(401);
  });

  it("PATCH /gestores/:id/estatus inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/gestores/999999/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(404);
  });
});
