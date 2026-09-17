import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Navegación al cliente (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "nav-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Nav2026";
  const PASSWORD = "Propietario#Nav2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-nav";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-nav";
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
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));

    await clienteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-NAV-1" });
    await propietarioRepo.delete({ codigo: "SC-NAV-1" });
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
      usuario: "propietario-nav-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-nav-1@correo.com",
      telefono: "+59171160130",
      codigo: "SC-NAV-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-nav-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-nav-1@correo.com",
      telefono: "+59172270130",
      codigo: "CB-NAV-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera NAV",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Juan",
        apellido: "Navegacion",
        negocio: "Tienda",
        telefonoWhatsapp: "+59171160131",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;
  });

  afterAll(async () => {
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-NAV-1" });
    await propietarioRepo.delete({ codigo: "SC-NAV-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET .../navegacion devuelve enlaces de Google Maps y Waze", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/navegacion?origenLat=-17.77&origenLng=-63.17`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.googleMapsUrl).toContain("google.com/maps/dir");
    expect(res.body.googleMapsUrl).toContain("origin=-17.77,-63.17");
    expect(res.body.googleMapsUrl).toContain("destination=-17.78,-63.18");
    expect(res.body.wazeUrl).toContain("waze.com/ul");
  });

  it("GET .../navegacion sin origen -> 400", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/navegacion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(400);
  });

  it("GET .../navegacion con origen fuera de rango -> 400", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/navegacion?origenLat=200&origenLng=-63.17`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(400);
  });

  it("GET .../navegacion con cliente inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/999999/navegacion?origenLat=-17.77&origenLng=-63.17`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET .../navegacion sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/navegacion?origenLat=-17.77&origenLng=-63.17`);

    expect(res.status).toBe(401);
  });

  it("un propietario SIN ver_reportes no puede navegar -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-nav-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-nav-2@correo.com",
      telefono: "+59171160132",
      codigo: "SC-NAV-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-nav-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/navegacion?origenLat=-17.77&origenLng=-63.17`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});