import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";

describe("Dashboard y monitoreo IA (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let accessTokenAdmin: string;
  let tokenSocio: string;

  const ADMIN_USERNAME = "dash-e2e-admin";
  const ADMIN_PASSWORD = "dash-e2e-password";
  const PASSWORD = "password-seguro";

  let rutaId: number;
  let clienteId: number;
  let prestamoId: number;

  beforeAll(async () => {
    process.env.JWT_SECRET = "dash-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "dash-e2e-refresh-secret";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    adminRepo = moduleFixture.get(getRepositoryToken(AdminUser));
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));

    await cobradorRepo.delete({ codigo: "CB-DASH-1" });
    await socioRepo.delete({ codigo: "SC-DASH-1" });
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

    const socio = await socioRepo.save({
      usuario: "socio-dash-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Dash",
      correo: "socio-dash-1@correo.com",
      telefono: "+59171160070",
      codigo: "SC-DASH-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const loginSocio = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-dash-1", password: PASSWORD });
    tokenSocio = loginSocio.body.accessToken as string;

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-dash-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "Dash",
      correo: "cobrador-dash-1@correo.com",
      telefono: "+59172260070",
      codigo: "CB-DASH-1",
      estatus: "activo",
    });
    const ruta = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta DASH-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 4,
      moneda: "BOB",
      costoCobro: 250,
      estatus: "activo",
    });
    rutaId = ruta.id;

    const cliente = await clienteRepo.save({
      ruta: { id: rutaId },
      rutaId,
      nombre: "Luis",
      apellido: "Paga",
      negocio: "Tienda",
      telefonoWhatsapp: "+59171160071",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      estatus: "activo",
      colorRiesgo: "blanco",
    });
    clienteId = cliente.id;

    const prestamo = await prestamoRepo.save({
      cliente: { id: clienteId },
      clienteId,
      ruta: { id: rutaId },
      rutaId,
      valor: 1000,
      numCuotas: 4,
      tipoInteres: 20,
      diasEntreCuotas: 7,
      fechaOtorgado: new Date("2026-08-01T00:00:00Z"),
      estatus: "vigente",
    });
    prestamoId = prestamo.id;
    await cuotaRepo.save({
      prestamo: { id: prestamoId },
      prestamoId,
      numeroCuota: 1,
      valorEsperado: 300,
      fechaVencimiento: "2026-09-01",
      estatus: "pendiente",
    } as never);
  });

  afterAll(async () => {
    await cuotaRepo.delete({ prestamo: { id: prestamoId } });
    await prestamoRepo.delete({ id: prestamoId });
    await clienteRepo.delete({ id: clienteId });
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-DASH-1" });
    await socioRepo.delete({ codigo: "SC-DASH-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /dashboard (admin) devuelve los indicadores consolidados", async () => {
    const res = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.carteraActiva).toBeGreaterThanOrEqual(300);
    expect(typeof res.body.moraTotal).toBe("number");
    expect(typeof res.body.cobradoDia).toBe("number");
    expect(typeof res.body.cobradoSemana).toBe("number");
    expect(typeof res.body.gastosPeriodo).toBe("number");
    expect(typeof res.body.comisionesPeriodo).toBe("number");
    expect(res.body.rutasActivas).toBeGreaterThanOrEqual(1);
  });

  it("GET /dashboard?rutaId= filtra por ruta (admin)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/dashboard?rutaId=${rutaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.carteraActiva).toBe("number");
    expect(res.body.rutasActivas).toBeGreaterThanOrEqual(1);
  });

  it("GET /conversaciones-ia/panel (admin) devuelve el monitoreo", async () => {
    const res = await request(app.getHttpServer())
      .get("/conversaciones-ia/panel")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.activas).toBe("number");
    expect(typeof res.body.derivadas).toBe("number");
    expect(typeof res.body.resueltas).toBe("number");
    expect(Array.isArray(res.body.derivadasRecientes)).toBe(true);
  });

  it("GET /dashboard como socio -> 403 (admin-only)", async () => {
    const res = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
  });

  it("GET /conversaciones-ia/panel como socio -> 403 (admin-only)", async () => {
    const res = await request(app.getHttpServer())
      .get("/conversaciones-ia/panel")
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
  });

  it("GET /dashboard sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/dashboard");
    expect(res.status).toBe(401);
  });

  it("GET /conversaciones-ia/panel sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/conversaciones-ia/panel");
    expect(res.status).toBe(401);
  });
});