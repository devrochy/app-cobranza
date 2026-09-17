import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Propietarios (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let accessToken: string;

  const ADMIN_USERNAME = "propietarios-e2e-admin";
  const ADMIN_PASSWORD = "propietarios-e2e-password";

  const propietarioPayload = {
    usuario: "propietario-e2e",
    password: "password-seguro",
    nombre: "Juan",
    apellido: "Pérez",
    correo: "juan@correo.com",
    telefono: "+59170000001",
    codigo: "SC-E2E-001",
    moneda: "BOB",
    estatus: "activo",
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "propietarios-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "propietarios-e2e-refresh-secret";
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

    await propietarioRepo.delete({ codigo: "SC-E2E-001" });
    await propietarioRepo.delete({ codigo: "SC-E2E-002" });
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
  });

  afterAll(async () => {
    await propietarioRepo.delete({ codigo: "SC-E2E-001" });
    await propietarioRepo.delete({ codigo: "SC-E2E-002" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /propietarios con token -> 201 y sin passwordHash en la respuesta", async () => {
    const res = await request(app.getHttpServer())
      .post("/propietarios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(propietarioPayload);

    expect(res.status).toBe(201);
    expect(res.body.usuario).toBe("propietario-e2e");
    expect(res.body.codigo).toBe("SC-E2E-001");
    expect(res.body.moneda).toBe("BOB");
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  it("POST /propietarios sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/propietarios")
      .send(propietarioPayload);

    expect(res.status).toBe(401);
  });

  it("POST /propietarios con payload inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/propietarios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...propietarioPayload,
        password: "corta",
        moneda: "peso",
        correo: "correo-invalido",
        telefono: "123",
      });

    expect(res.status).toBe(400);
  });

  it("POST /propietarios con estatus inválido, campos vacíos o moneda en minúsculas -> 400", async () => {
    const casos = [
      { ...propietarioPayload, usuario: "propietario-e2e-x1", estatus: "pendiente" },
      { ...propietarioPayload, usuario: "propietario-e2e-x2", nombre: "", apellido: "", codigo: "" },
      { ...propietarioPayload, usuario: "propietario-e2e-x3", moneda: "bob" },
    ];

    for (const payload of casos) {
      const res = await request(app.getHttpServer())
        .post("/propietarios")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload);

      expect(res.status).toBe(400);
    }
  });

  it("POST /propietarios sin estatus -> 201 con estatus activo por defecto", async () => {
    const sinEstatus = {
      usuario: "propietario-e2e-2",
      password: "password-seguro",
      nombre: "María",
      apellido: "Gómez",
      correo: "maria@correo.com",
      telefono: "+59170000002",
      codigo: "SC-E2E-002",
      moneda: "BOB",
    };
    const res = await request(app.getHttpServer())
      .post("/propietarios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(sinEstatus);

    expect(res.status).toBe(201);
    expect(res.body.estatus).toBe("activo");
  });

  it("POST /propietarios duplicado -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post("/propietarios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(propietarioPayload);

    expect(res.status).toBe(409);
  });

  it("GET /propietarios/:id devuelve el propietario con los campos de configuración", async () => {
    const propietario = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-001" } });

    const res = await request(app.getHttpServer())
      .get(`/propietarios/${propietario!.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.codigo).toBe("SC-E2E-001");
    expect(res.body).toHaveProperty("pais");
    expect(res.body).toHaveProperty("nombreOficinaCobro");
    expect(res.body.diasToleranciaCobro).toBe(5);
  });

  it("GET /propietarios/:id como propietario -> 403 (admin-only)", async () => {
    const propietario = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-002" } });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-e2e-2", password: "password-seguro" });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/propietarios/${propietario!.id}`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
  });

  it("PATCH /propietarios/:id/configuracion actualiza la configuración (admin)", async () => {
    const propietario = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-001" } });

    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietario!.id}/configuracion`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ pais: "BO", nombreOficinaCobro: "Oficina Central", diasToleranciaCobro: 3 });

    expect(res.status).toBe(200);
    expect(res.body.pais).toBe("BO");
    expect(res.body.nombreOficinaCobro).toBe("Oficina Central");
    expect(res.body.diasToleranciaCobro).toBe(3);
  });

  it("PATCH .../configuracion con diasToleranciaCobro negativo -> 400", async () => {
    const propietario = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-001" } });

    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietario!.id}/configuracion`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ diasToleranciaCobro: -1 });

    expect(res.status).toBe(400);
  });

  it("PATCH .../configuracion con nombreOficinaCobro demasiado largo -> 400", async () => {
    const propietario = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-001" } });

    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietario!.id}/configuracion`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombreOficinaCobro: "x".repeat(256) });

    expect(res.status).toBe(400);
  });

  it("un propietario SIN editar_configuracion_propietario no puede configurar su propio propietario -> 403", async () => {
    const propietario = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-002" } });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-e2e-2", password: "password-seguro" });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .patch(`/propietarios/${propietario!.id}/configuracion`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ nombreOficinaCobro: "Mi Oficina" });

    expect(res.status).toBe(403);
  });

  it("un propietario con editar_configuracion_propietario configura su propio propietario -> 200, y otro -> 403", async () => {
    const propio = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-001" } });
    const otro = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-002" } });

    await request(app.getHttpServer())
      .put(`/propietarios/${propio!.id}/permisos`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ matriz: { editar_configuracion_propietario: true } });

    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-e2e", password: "password-seguro" });
    const tokenPropietario = login.body.accessToken as string;

    const propioRes = await request(app.getHttpServer())
      .patch(`/propietarios/${propio!.id}/configuracion`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ nombreOficinaCobro: "Mi Oficina" });
    expect(propioRes.status).toBe(200);
    expect(propioRes.body.nombreOficinaCobro).toBe("Mi Oficina");

    const otroRes = await request(app.getHttpServer())
      .patch(`/propietarios/${otro!.id}/configuracion`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ nombreOficinaCobro: "Oficina Ajena" });
    expect(otroRes.status).toBe(403);
  });

  describe("GET /propietarios (listado)", () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post("/propietarios")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          usuario: "propietario-e2e-3",
          password: "password-seguro",
          nombre: "Luis",
          apellido: "Torres",
          correo: "luis@correo.com",
          telefono: "+59170000003",
          codigo: "SC-E2E-003",
          moneda: "BOB",
          estatus: "bloqueado",
        });
    });

    afterAll(async () => {
      await propietarioRepo.delete({ codigo: "SC-E2E-003" });
    });

    it("devuelve todos los propietarios sin passwordHash como admin", async () => {
      const res = await request(app.getHttpServer())
        .get("/propietarios")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const codigos = res.body.map((s: { codigo: string }) => s.codigo);
      expect(codigos).toContain("SC-E2E-001");
      expect(codigos).toContain("SC-E2E-002");
      expect(codigos).toContain("SC-E2E-003");
      expect(Object.keys(res.body[0])).not.toContain("passwordHash");
    });

    it("filtra por busqueda (ILIKE)", async () => {
      const res = await request(app.getHttpServer())
        .get("/propietarios")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ busqueda: "juan" });

      expect(res.status).toBe(200);
      const codigos = res.body.map((s: { codigo: string }) => s.codigo);
      expect(codigos).toContain("SC-E2E-001");
      expect(codigos).not.toContain("SC-E2E-002");
      expect(codigos).not.toContain("SC-E2E-003");
    });

    it("filtra por estatus", async () => {
      const bloqueados = await request(app.getHttpServer())
        .get("/propietarios")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ estatus: "bloqueado" });
      const activos = await request(app.getHttpServer())
        .get("/propietarios")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ estatus: "activo" });

      const codigosBloqueados = bloqueados.body.map((s: { codigo: string }) => s.codigo);
      expect(codigosBloqueados).toContain("SC-E2E-003");
      expect(codigosBloqueados).not.toContain("SC-E2E-001");

      const codigosActivos = activos.body.map((s: { codigo: string }) => s.codigo);
      expect(codigosActivos).toContain("SC-E2E-001");
      expect(codigosActivos).toContain("SC-E2E-002");
      expect(codigosActivos).not.toContain("SC-E2E-003");
    });

    it("rechaza un estatus inválido con 400", async () => {
      const res = await request(app.getHttpServer())
        .get("/propietarios")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ estatus: "pendiente" });

      expect(res.status).toBe(400);
    });

    it("responde 401 sin token", async () => {
      const res = await request(app.getHttpServer()).get("/propietarios");
      expect(res.status).toBe(401);
    });

    it("un propietario con ver_reportes ve solo su propio perfil", async () => {
      const propio = await propietarioRepo.findOne({ where: { codigo: "SC-E2E-001" } });
      await request(app.getHttpServer())
        .put(`/propietarios/${propio!.id}/permisos`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ matriz: { ver_reportes: true } });

      const login = await request(app.getHttpServer())
        .post("/auth/propietario/login")
        .send({ usuario: "propietario-e2e", password: "password-seguro" });
      const tokenPropietario = login.body.accessToken as string;

      const res = await request(app.getHttpServer())
        .get("/propietarios")
        .set("Authorization", `Bearer ${tokenPropietario}`);

      expect(res.status).toBe(200);
      const codigos = res.body.map((s: { codigo: string }) => s.codigo);
      expect(codigos).toEqual(["SC-E2E-001"]);
    });
  });
});
