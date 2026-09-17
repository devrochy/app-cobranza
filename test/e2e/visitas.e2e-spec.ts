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
import { PromesaPago } from "../../src/modules/clientes/promesa-pago.entity";
import { Visita } from "../../src/modules/clientes/visita.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Caja } from "../../src/modules/carteras/caja.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Registro de visitas (e2e)", () => {
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
  let visitaRepo: Repository<Visita>;
  let promesaRepo: Repository<PromesaPago>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let carteraId: number;
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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
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
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-VISITAS-1" });
    await propietarioRepo.delete({ codigo: "SC-VISITAS-1" });

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
      usuario: "propietario-visitas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-visitas-1@correo.com",
      telefono: "+59171160022",
      codigo: "SC-VISITAS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-visitas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-visitas-1@correo.com",
      telefono: "+59172270022",
      codigo: "CB-VISITAS-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera VISITAS",
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
        apellido: "Visita",
        negocio: "Tienda",
        telefonoWhatsapp: "+59171160023",
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
    await promesaRepo.createQueryBuilder().delete().execute();
    await visitaRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.delete({ id: prestamoId });
    await clienteRepo.delete({ id: clienteId });
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-VISITAS-1" });
    await propietarioRepo.delete({ codigo: "SC-VISITAS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /carteras/:id/visitas con resultado no_pago registra la visita", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/visitas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, clienteId, resultado: "no_pago", motivoNoPago: "no_esta" });

    expect(res.status).toBe(201);
    expect(res.body.resultado).toBe("no_pago");
    expect(res.body.motivoNoPago).toBe("no_esta");
  });

  it("POST /carteras/:id/visitas con compromiso_de_pago crea la promesa", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/visitas`)
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

  it("POST /carteras/:id/visitas con compromiso_de_pago sin fecha -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/visitas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, clienteId, resultado: "no_pago", motivoNoPago: "compromiso_de_pago" });

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:id/visitas con resultado pago ejecuta el pago de cuota y actualiza caja", async () => {
    const cuota = await cuotaRepo.findOne({ where: { prestamo: { id: prestamoId }, numeroCuota: 1 } });
    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });

    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/visitas`)
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

    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + cuota!.valorEsperado);
  });

  it("POST /carteras/:id/visitas con resultado pago abono ejecuta el abono y actualiza caja", async () => {
    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });

    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/visitas`)
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

    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + 40);
  });

  it("POST /carteras/:id/visitas sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/visitas`)
      .send({ prestamoId, clienteId, resultado: "no_pago", motivoNoPago: "no_esta" });

    expect(res.status).toBe(401);
  });
});
