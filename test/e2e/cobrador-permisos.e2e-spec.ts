import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { COBRADOR_PERMISOS } from "../../src/modules/cobradores/cobrador-permiso.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Matriz de permisos de cobrador gestionada por el socio (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let accessTokenAdmin: string;
  let tokenSocio1: string;
  let tokenSocio2: string;
  let socio1Id: number;
  let socio2Id: number;
  let cobrador1Id: number;
  let cobrador2Id: number;

  const ADMIN_USERNAME = "cp-e2e-admin";
  const ADMIN_PASSWORD = "cp-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));

    await cobradorRepo.delete({ codigo: "CB-CP-X" });
    await cobradorRepo.delete({ codigo: "CB-CP-Y" });
    await cobradorRepo.delete({ codigo: "CB-CP-1" });
    await cobradorRepo.delete({ codigo: "CB-CP-2" });
    await socioRepo.delete({ codigo: "SC-CP-1" });
    await socioRepo.delete({ codigo: "SC-CP-2" });
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

    const socio1 = await socioRepo.save({
      usuario: "socio-cp-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Ruiz",
      correo: "socio-cp-1@correo.com",
      telefono: "+59178888881",
      codigo: "SC-CP-1",
      moneda: "BOB",
      estatus: "activo",
    });
    socio1Id = socio1.id;

    const socio2 = await socioRepo.save({
      usuario: "socio-cp-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Luis",
      apellido: "Mora",
      correo: "socio-cp-2@correo.com",
      telefono: "+59178888882",
      codigo: "SC-CP-2",
      moneda: "BOB",
      estatus: "activo",
    });
    socio2Id = socio2.id;

    await request(app.getHttpServer())
      .put(`/socios/${socio1Id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { editar_permisos: true, registrar_cobrador: true } });

    const cobrador1 = await cobradorRepo.save({
      socio: { id: socio1Id },
      usuario: "cobrador-cp-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "López",
      correo: "cobrador-cp-1@correo.com",
      telefono: "+59179998881",
      codigo: "CB-CP-1",
      estatus: "activo",
    });
    cobrador1Id = cobrador1.id;

    const cobrador2 = await cobradorRepo.save({
      socio: { id: socio2Id },
      usuario: "cobrador-cp-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Pedro",
      apellido: "Gómez",
      correo: "cobrador-cp-2@correo.com",
      telefono: "+59179998882",
      codigo: "CB-CP-2",
      estatus: "activo",
    });
    cobrador2Id = cobrador2.id;

    tokenSocio1 = await loginSocio("socio-cp-1");
    tokenSocio2 = await loginSocio("socio-cp-2");
  });

  afterAll(async () => {
    await cobradorRepo.delete({ codigo: "CB-CP-X" });
    await cobradorRepo.delete({ codigo: "CB-CP-Y" });
    await cobradorRepo.delete({ id: cobrador1Id });
    await cobradorRepo.delete({ id: cobrador2Id });
    await socioRepo.delete({ id: socio1Id });
    await socioRepo.delete({ id: socio2Id });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /cobradores como admin devuelve todos", async () => {
    const res = await request(app.getHttpServer())
      .get("/cobradores")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const codigos = res.body.map((c: { codigo: string }) => c.codigo);
    expect(codigos).toContain("CB-CP-1");
    expect(codigos).toContain("CB-CP-2");
  });

  it("GET /cobradores como socio con editar_permisos devuelve solo sus colaboradores", async () => {
    const res = await request(app.getHttpServer())
      .get("/cobradores")
      .set("Authorization", `Bearer ${tokenSocio1}`);

    expect(res.status).toBe(200);
    const codigos = res.body.map((c: { codigo: string }) => c.codigo);
    expect(codigos).toContain("CB-CP-1");
    expect(codigos).not.toContain("CB-CP-2");
  });

  it("GET /cobradores/:id/permisos de un cobrador propio -> 200 con los 12 permisos", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobradores/${cobrador1Id}/permisos`)
      .set("Authorization", `Bearer ${tokenSocio1}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(COBRADOR_PERMISOS.length);
    expect(res.body.every((p: { habilitado: boolean }) => p.habilitado === false)).toBe(true);
  });

  it("PUT /cobradores/:id/permisos de un cobrador propio -> 200", async () => {
    const res = await request(app.getHttpServer())
      .put(`/cobradores/${cobrador1Id}/permisos`)
      .set("Authorization", `Bearer ${tokenSocio1}`)
      .send({ matriz: { registrar_pago: true } });

    expect(res.status).toBe(200);
    expect(res.body.find((p: { permiso: string }) => p.permiso === "registrar_pago")?.habilitado).toBe(true);
  });

  it("GET /cobradores/:id/permisos de un cobrador ajeno -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cobradores/${cobrador2Id}/permisos`)
      .set("Authorization", `Bearer ${tokenSocio1}`);

    expect(res.status).toBe(403);
  });

  it("PUT /cobradores/:id/permisos de un cobrador ajeno -> 403", async () => {
    const res = await request(app.getHttpServer())
      .put(`/cobradores/${cobrador2Id}/permisos`)
      .set("Authorization", `Bearer ${tokenSocio1}`)
      .send({ matriz: { registrar_pago: true } });

    expect(res.status).toBe(403);
  });

  it("un socio no puede crear un cobrador bajo otro socioId -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${tokenSocio1}`)
      .send({
        socioId: socio2Id,
        usuario: "cobrador-cp-x",
        password: PASSWORD,
        nombre: "X",
        apellido: "Y",
        correo: "cobrador-cp-x@correo.com",
        telefono: "+59179998883",
        codigo: "CB-CP-X",
      });

    expect(res.status).toBe(403);
  });

  it("un socio puede crear un cobrador bajo su propio socioId -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${tokenSocio1}`)
      .send({
        socioId: socio1Id,
        usuario: "cobrador-cp-y",
        password: PASSWORD,
        nombre: "Y",
        apellido: "Z",
        correo: "cobrador-cp-y@correo.com",
        telefono: "+59179998884",
        codigo: "CB-CP-Y",
      });

    expect(res.status).toBe(201);
  });

  it("un socio no puede bloquear un cobrador ajeno -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cobradores/${cobrador2Id}/estatus`)
      .set("Authorization", `Bearer ${tokenSocio1}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(403);
  });

  it("GET /cobradores como socio SIN editar_permisos -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get("/cobradores")
      .set("Authorization", `Bearer ${tokenSocio2}`);

    expect(res.status).toBe(403);
  });

  it("GET /cobradores sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/cobradores");

    expect(res.status).toBe(401);
  });
});
