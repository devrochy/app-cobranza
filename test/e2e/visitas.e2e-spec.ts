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
import { PromesaPago } from "../../src/modules/cartera/promesa-pago.entity";
import { Visita } from "../../src/modules/cartera/visita.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Caja } from "../../src/modules/rutas/caja.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Registro de visitas (e2e)", () => {
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
  let visitaRepo: Repository<Visita>;
  let promesaRepo: Repository<PromesaPago>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;
  let prestamoId: number;

  const ADMIN_USERNAME = "visitas-e2e-admin";
  const ADMIN_PASSWORD = "visitas-e2e-password";
  const PASSWORD = "password-seguro";

  beforeAll(async () => {
    process.env.JWT_SECRET = "visitas-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "visitas-e2e-refresh-secret";
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
    visitaRepo = moduleFixture.get(getRepositoryToken(Visita));
    promesaRepo = moduleFixture.get(getRepositoryToken(PromesaPago));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));

    await promesaRepo.createQueryBuilder().delete().execute();
    await visitaRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-VISITAS-1" });
    await socioRepo.delete({ codigo: "SC-VISITAS-1" });

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
      usuario: "socio-visitas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-visitas-1@correo.com",
      telefono: "+59171160022",
      codigo: "SC-VISITAS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-visitas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-visitas-1@correo.com",
      telefono: "+59172270022",
      codigo: "CB-VISITAS-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta VISITAS",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
      });
    rutaId = rutaRes.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Juan",
        apellido: "Visita",
        negocio: "Tienda",
        telefonoWhatsapp: "+59171160023",
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
    await promesaRepo.createQueryBuilder().delete().execute();
    await visitaRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.delete({ id: prestamoId });
    await clienteRepo.delete({ id: clienteId });
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-VISITAS-1" });
    await socioRepo.delete({ codigo: "SC-VISITAS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas/:id/visitas con resultado no_pago registra la visita", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/visitas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, clienteId, resultado: "no_pago", motivoNoPago: "no_esta" });

    expect(res.status).toBe(201);
    expect(res.body.resultado).toBe("no_pago");
    expect(res.body.motivoNoPago).toBe("no_esta");
  });

  it("POST /rutas/:id/visitas con compromiso_de_pago crea la promesa", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/visitas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        prestamoId,
        clienteId,
        resultado: "no_pago",
        motivoNoPago: "compromiso_de_pago",
        fechaPrometida: "2026-08-30",
      });

    expect(res.status).toBe(201);
    const promesa = await promesaRepo
      .createQueryBuilder("p")
      .where("p.prestamo_id = :prestamoId", { prestamoId })
      .getOne();
    expect(promesa).toBeDefined();
    expect(promesa?.estado).toBe("pendiente");
    expect(promesa?.fechaPrometida).toBe("2026-08-30");
  });

  it("POST /rutas/:id/visitas con compromiso_de_pago sin fecha -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/visitas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, clienteId, resultado: "no_pago", motivoNoPago: "compromiso_de_pago" });

    expect(res.status).toBe(400);
  });

  it("POST /rutas/:id/visitas con resultado pago ejecuta el pago de cuota y actualiza caja", async () => {
    const cuota = await cuotaRepo.findOne({ where: { prestamo: { id: prestamoId }, numeroCuota: 1 } });
    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/visitas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        prestamoId,
        clienteId,
        resultado: "pago",
        tipoPago: "cuota",
        cuotaId: cuota!.id,
        valor: cuota!.valorEsperado,
        metodoPago: "efectivo",
      });

    expect(res.status).toBe(201);
    expect(res.body.resultado).toBe("pago");
    expect(res.body.valorPagado).toBe(cuota!.valorEsperado);

    const cuotaActualizada = await cuotaRepo.findOne({ where: { id: cuota!.id } });
    expect(cuotaActualizada?.estatus).toBe("pagada");

    const pago = await pagoRepo
      .createQueryBuilder("pg")
      .where("pg.cuota_id = :cuotaId", { cuotaId: cuota!.id })
      .getOne();
    expect(pago).toBeDefined();
    expect(pago?.visitaId).not.toBeNull();

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + cuota!.valorEsperado);
  });

  it("POST /rutas/:id/visitas con resultado pago abono ejecuta el abono y actualiza caja", async () => {
    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/visitas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        prestamoId,
        clienteId,
        resultado: "pago",
        tipoPago: "abono",
        valor: 40,
        metodoPago: "transferencia",
      });

    expect(res.status).toBe(201);
    expect(res.body.resultado).toBe("pago");
    expect(res.body.valorPagado).toBe(40);

    const abono = await abonoRepo
      .createQueryBuilder("a")
      .where("a.prestamo_id = :prestamoId", { prestamoId })
      .getOne();
    expect(abono).toBeDefined();
    expect(abono?.visitaId).not.toBeNull();

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + 40);
  });

  it("POST /rutas/:id/visitas sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/visitas`)
      .send({ prestamoId, clienteId, resultado: "no_pago", motivoNoPago: "no_esta" });

    expect(res.status).toBe(401);
  });
});
