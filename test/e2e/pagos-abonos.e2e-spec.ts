import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Abono } from "../../src/modules/clientes/abono.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Pago } from "../../src/modules/clientes/pago.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Caja } from "../../src/modules/carteras/caja.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Registro de pagos y abonos (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let abonoRepo: Repository<Abono>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;
  let prestamoId: number;
  let cuotaId: number;

  const ADMIN_USERNAME = "pagos-e2e-admin";
  const ADMIN_PASSWORD = "pagos-e2e-password";
  const PASSWORD = "password-seguro";

  beforeAll(async () => {
    process.env.JWT_SECRET = "pagos-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "pagos-e2e-refresh-secret";
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
    pagoRepo = moduleFixture.get(getRepositoryToken(Pago));
    abonoRepo = moduleFixture.get(getRepositoryToken(Abono));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));

    await pagoRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-PAGOS-1" });
    await propietarioRepo.delete({ codigo: "SC-PAGOS-1" });

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
      usuario: "propietario-pagos-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-pagos-1@correo.com",
      telefono: "+59171160012",
      codigo: "SC-PAGOS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-pagos-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-pagos-1@correo.com",
      telefono: "+59172270012",
      codigo: "CB-PAGOS-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera PAGOS",
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
        apellido: "Pago",
        negocio: "Tienda",
        telefonoWhatsapp: "+59171160013",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        clienteId,
        valor: 1000,
        numCuotas: 4,
        diasEntreCuotas: 7,
      });
    prestamoId = prestamoRes.body.id as number;
  });

  afterAll(async () => {
    await pagoRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.delete({ id: prestamoId });
    await clienteRepo.delete({ id: clienteId });
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-PAGOS-1" });
    await propietarioRepo.delete({ codigo: "SC-PAGOS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /carteras/:id/pagos marca la cuota pagada y aumenta la caja", async () => {
    const cuota = await cuotaRepo.findOne({ where: { prestamo: { id: prestamoId }, numeroCuota: 1 } });
    cuotaId = cuota!.id;

    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId, valor: cuota!.valorEsperado, metodoPago: "efectivo" });

    expect(res.status).toBe(201);
    expect(res.body.cuotaId).toBe(cuotaId);
    expect(res.body.metodoPago).toBe("efectivo");

    const cuotaActualizada = await cuotaRepo.findOne({ where: { id: cuotaId } });
    expect(cuotaActualizada?.estatus).toBe("pagada");

    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + cuota!.valorEsperado);
  });

  it("POST /carteras/:id/pagos con valor distinto al esperado -> 400", async () => {
    const cuota = await cuotaRepo.findOne({ where: { prestamo: { id: prestamoId }, numeroCuota: 2 } });
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: cuota!.id, valor: 1, metodoPago: "efectivo" });

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:id/abonos registra el abono y aumenta la caja", async () => {
    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, valor: 50, metodoPago: "transferencia" });

    expect(res.status).toBe(201);
    expect(res.body.prestamoId).toBe(prestamoId);
    expect(res.body.metodoPago).toBe("transferencia");

    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + 50);
  });

  it("POST /carteras/:id/abonos que excede la deuda pendiente -> 400", async () => {
    // La deuda del préstamo es finita; un valor muy alto excede la deuda pendiente.
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, valor: 9999999, metodoPago: "efectivo" });

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:id/pagos con método inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: 1, valor: 100, metodoPago: "bitcoin" });

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:id/pagos sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .send({ cuotaId: 1, valor: 100, metodoPago: "efectivo" });

    expect(res.status).toBe(401);
  });

  it("un propietario sin configurar_cartera no puede registrar pagos -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-pagos-sinperm",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "SinPerm",
      correo: "propietario-pagos-sinperm@correo.com",
      telefono: "+59171160014",
      codigo: "SC-PAGOS-SINPERM",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-pagos-sinperm", password: PASSWORD });
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cuotaId: 1, valor: 100, metodoPago: "efectivo" });

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});
