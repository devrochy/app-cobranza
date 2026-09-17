import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Tarjeta de cliente (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "tarj-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Tarj2026";
  const PASSWORD = "Propietario#Tarj2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-tarj";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-tarj";
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
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));

    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-TARJ-1" });
    await propietarioRepo.delete({ codigo: "SC-TARJ-1" });
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
      usuario: "propietario-tarj-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-tarj-1@correo.com",
      telefono: "+59171160120",
      codigo: "SC-TARJ-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-tarj-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-tarj-1@correo.com",
      telefono: "+59172270120",
      codigo: "CB-TARJ-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera TARJ",
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
        apellido: "Tarjeta",
        negocio: "Tienda",
        telefonoWhatsapp: "+59171160121",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    // Préstamo semanal (7 días) para derivar tipo de pago.
    await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
  });

  afterAll(async () => {
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id = :carteraId)", { carteraId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-TARJ-1" });
    await propietarioRepo.delete({ codigo: "SC-TARJ-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /carteras/:carteraId/clientes/:clienteId/tarjeta devuelve la tarjeta", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/tarjeta`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Juan Tarjeta");
    expect(res.body.negocio).toBe("Tienda");
    expect(res.body.telefonoWhatsapp).toBe("+59171160121");
    expect(res.body.tipoPago).toBe("semanal");
    expect(res.body.saldoPendiente).toBeGreaterThan(0);
    expect(res.body.diasMora).toBeGreaterThanOrEqual(0);
  });

  it("GET .../tarjeta con cliente inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/999999/tarjeta`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET .../tarjeta sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraId}/clientes/${clienteId}/tarjeta`);

    expect(res.status).toBe(401);
  });

  it("un propietario SIN ver_reportes no puede ver la tarjeta -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-tarj-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-tarj-2@correo.com",
      telefono: "+59171160122",
      codigo: "SC-TARJ-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-tarj-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/tarjeta`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});