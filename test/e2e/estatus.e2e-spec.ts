import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Bloqueo/activación de socio y cobrador (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let accessToken: string;
  let socioId: number;
  let cobradorId: number;

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));

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
      usuario: "socio-es-1",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Juan",
      apellido: "Pérez",
      correo: "socio-es1@correo.com",
      telefono: "+59174444441",
      codigo: "SC-ES-001",
      moneda: "BOB",
      estatus: "activo",
    });
    socioId = socio.id;

    const cobrador = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        socioId,
        usuario: "cobrador-es",
        password: "password-seguro",
        nombre: "Carlos",
        apellido: "López",
        correo: "cobrador-es@correo.com",
        telefono: "+59175555555",
        codigo: "CB-ES-001",
      });
    cobradorId = cobrador.body.id as number;
  });

  afterAll(async () => {
    await cobradorRepo.delete({ id: cobradorId });
    await socioRepo.delete({ id: socioId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("PATCH /socios/:id/estatus -> 200 bloquea sin passwordHash y conserva el hash de la contraseña", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("bloqueado");
    expect(Object.keys(res.body)).not.toContain("passwordHash");

    const persisted = await socioRepo
      .createQueryBuilder("s")
      .addSelect("s.passwordHash")
      .where("s.id = :id", { id: socioId })
      .getOne();
    expect(persisted).toBeDefined();
    expect(await bcrypt.compare("password-seguro", persisted!.passwordHash)).toBe(true);
  });

  it("PATCH /socios/:id/estatus -> 200 reactiva", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "activo" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("activo");
  });

  it("PATCH /socios/:id/estatus es idempotente (dos PATCH con el mismo estatus)", async () => {
    const primero = await request(app.getHttpServer())
      .patch(`/socios/${socioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });
    const segundo = await request(app.getHttpServer())
      .patch(`/socios/${socioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(primero.status).toBe(200);
    expect(segundo.status).toBe(200);
    expect(segundo.body.estatus).toBe("bloqueado");
  });

  it("PATCH /socios/:id/estatus con estatus inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "pendiente" });

    expect(res.status).toBe(400);
  });

  it("PATCH /socios/:id/estatus inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/999999/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(404);
  });

  it("PATCH /socios/:id/estatus sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}/estatus`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(401);
  });

  it("PATCH /cobradores/:id/estatus -> 200 bloquea sin passwordHash y conserva el hash", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cobradores/${cobradorId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("bloqueado");
    expect(Object.keys(res.body)).not.toContain("passwordHash");

    const persisted = await cobradorRepo
      .createQueryBuilder("c")
      .addSelect("c.passwordHash")
      .where("c.id = :id", { id: cobradorId })
      .getOne();
    expect(persisted).toBeDefined();
    expect(await bcrypt.compare("password-seguro", persisted!.passwordHash)).toBe(true);
  });

  it("PATCH /cobradores/:id/estatus -> 200 reactiva", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cobradores/${cobradorId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "activo" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("activo");
  });

  it("PATCH /cobradores/:id/estatus con estatus inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cobradores/${cobradorId}/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "pendiente" });

    expect(res.status).toBe(400);
  });

  it("PATCH /cobradores/:id/estatus sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cobradores/${cobradorId}/estatus`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(401);
  });

  it("PATCH /cobradores/:id/estatus inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cobradores/999999/estatus`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(404);
  });
});
