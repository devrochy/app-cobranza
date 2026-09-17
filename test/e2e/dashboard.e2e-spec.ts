import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";

describe("Dashboard y monitoreo IA (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let accessTokenAdmin: string;
  let tokenPropietario: string;

  const ADMIN_USERNAME = "dash-e2e-admin";
  const ADMIN_PASSWORD = "dash-e2e-password";
  const PASSWORD = "password-seguro";

  let carteraId: number;
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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));

    await gestorRepo.delete({ codigo: "CB-DASH-1" });
    await propietarioRepo.delete({ codigo: "SC-DASH-1" });
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

    const propietario = await propietarioRepo.save({
      usuario: "propietario-dash-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Dash",
      correo: "propietario-dash-1@correo.com",
      telefono: "+59171160070",
      codigo: "SC-DASH-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const loginPropietario = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-dash-1", password: PASSWORD });
    tokenPropietario = loginPropietario.body.accessToken as string;

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-dash-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "Dash",
      correo: "gestor-dash-1@correo.com",
      telefono: "+59172260070",
      codigo: "CB-DASH-1",
      estatus: "activo",
    });
    const cartera = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera DASH-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 4,
      moneda: "BOB",
      costoCobro: 250,
      estatus: "activo",
    });
    carteraId = cartera.id;

    const cliente = await clienteRepo.save({
      cartera: { id: carteraId },
      carteraId,
      nombre: "Luis",
      apellido: "Paga",
      negocio: "Tienda",
      telefonoWhatsapp: "+59171160071",
      tipoDocumento: "ci",
      numeroDocumento: "1234567",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      estatus: "activo",
      colorRiesgo: "blanco",
    });
    clienteId = cliente.id;

    const prestamo = await prestamoRepo.save({
      cliente: { id: clienteId },
      clienteId,
      cartera: { id: carteraId },
      carteraId,
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
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-DASH-1" });
    await propietarioRepo.delete({ codigo: "SC-DASH-1" });
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
    expect(res.body.carterasActivas).toBeGreaterThanOrEqual(1);
  });

  it("GET /dashboard?carteraId= filtra por cartera (admin)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/dashboard?carteraId=${carteraId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.carteraActiva).toBe("number");
    expect(res.body.carterasActivas).toBeGreaterThanOrEqual(1);
  });

  it("GET /dashboard/series (admin) devuelve la serie diaria de N días", async () => {
    const res = await request(app.getHttpServer())
      .get(`/dashboard/series?carteraId=${carteraId}&dias=7`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.dias)).toBe(true);
    expect(res.body.dias).toHaveLength(7);
    expect(res.body.dias[0]).toEqual(
      expect.objectContaining({
        fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        cobrado: expect.any(Number),
        gastos: expect.any(Number),
      }),
    );
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

  it("GET /dashboard como propietario -> 403 (admin-only)", async () => {
    const res = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
  });

  it("GET /conversaciones-ia/panel como propietario -> 403 (admin-only)", async () => {
    const res = await request(app.getHttpServer())
      .get("/conversaciones-ia/panel")
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
  });

  it("GET /dashboard/sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/dashboard");
    expect(res.status).toBe(401);
  });

  it("GET /dashboard/series sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/dashboard/series");
    expect(res.status).toBe(401);
  });

  it("GET /dashboard/series como propietario -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get("/dashboard/series")
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
  });

  it("GET /conversaciones-ia/panel sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/conversaciones-ia/panel");
    expect(res.status).toBe(401);
  });
});