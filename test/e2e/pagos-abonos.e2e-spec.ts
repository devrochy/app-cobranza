import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Abono } from "../../src/modules/cartera/abono.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Pago } from "../../src/modules/cartera/pago.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Caja } from "../../src/modules/rutas/caja.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Registro de pagos y abonos (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let abonoRepo: Repository<Abono>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let rutaId: number;
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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
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
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-PAGOS-1" });
    await socioRepo.delete({ codigo: "SC-PAGOS-1" });

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
      usuario: "socio-pagos-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-pagos-1@correo.com",
      telefono: "+59171160012",
      codigo: "SC-PAGOS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-pagos-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-pagos-1@correo.com",
      telefono: "+59172270012",
      codigo: "CB-PAGOS-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta PAGOS",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Juan",
        apellido: "Pago",
        negocio: "Tienda",
        telefonoWhatsapp: "+59171160013",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
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
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-PAGOS-1" });
    await socioRepo.delete({ codigo: "SC-PAGOS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas/:id/pagos marca la cuota pagada y aumenta la caja", async () => {
    const cuota = await cuotaRepo.findOne({ where: { prestamo: { id: prestamoId }, numeroCuota: 1 } });
    cuotaId = cuota!.id;

    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId, valor: cuota!.valorEsperado, metodoPago: "efectivo" });

    expect(res.status).toBe(201);
    expect(res.body.cuotaId).toBe(cuotaId);
    expect(res.body.metodoPago).toBe("efectivo");

    const cuotaActualizada = await cuotaRepo.findOne({ where: { id: cuotaId } });
    expect(cuotaActualizada?.estatus).toBe("pagada");

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + cuota!.valorEsperado);
  });

  it("POST /rutas/:id/pagos con valor distinto al esperado -> 400", async () => {
    const cuota = await cuotaRepo.findOne({ where: { prestamo: { id: prestamoId }, numeroCuota: 2 } });
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: cuota!.id, valor: 1, metodoPago: "efectivo" });

    expect(res.status).toBe(400);
  });

  it("POST /rutas/:id/abonos registra el abono y aumenta la caja", async () => {
    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, valor: 50, metodoPago: "transferencia" });

    expect(res.status).toBe(201);
    expect(res.body.prestamoId).toBe(prestamoId);
    expect(res.body.metodoPago).toBe("transferencia");

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + 50);
  });

  it("POST /rutas/:id/abonos que excede la deuda pendiente -> 400", async () => {
    // La deuda del préstamo es finita; un valor muy alto excede la deuda pendiente.
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, valor: 9999999, metodoPago: "efectivo" });

    expect(res.status).toBe(400);
  });

  it("POST /rutas/:id/pagos con método inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: 1, valor: 100, metodoPago: "bitcoin" });

    expect(res.status).toBe(400);
  });

  it("POST /rutas/:id/pagos sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/pagos`)
      .send({ cuotaId: 1, valor: 100, metodoPago: "efectivo" });

    expect(res.status).toBe(401);
  });

  it("un socio sin configurar_ruta no puede registrar pagos -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-pagos-sinperm",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "SinPerm",
      correo: "socio-pagos-sinperm@correo.com",
      telefono: "+59171160014",
      codigo: "SC-PAGOS-SINPERM",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-pagos-sinperm", password: PASSWORD });
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/pagos`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cuotaId: 1, valor: 100, metodoPago: "efectivo" });

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});
