import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { CobroPropietario } from "../../src/modules/cobros-propietario/cobro-propietario.entity";
import { ConversacionPropietario } from "../../src/modules/cobros-propietario/conversacion-propietario.entity";
import { LinkPago } from "../../src/modules/cobros-propietario/link-pago.entity";
import { MensajePropietario } from "../../src/modules/cobros-propietario/mensaje-propietario.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Cobro mensual a propietarios (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let cobroRepo: Repository<CobroPropietario>;
  let linkRepo: Repository<LinkPago>;
  let conversacionRepo: Repository<ConversacionPropietario>;
  let mensajeRepo: Repository<MensajePropietario>;
  let accessTokenAdmin: string;
  let propietarioId: number;
  let gestorId: number;
  let carteraId: number;

  const ADMIN_USERNAME = "cobros-e2e-admin";
  const ADMIN_PASSWORD = "cobros-e2e-password";
  const PASSWORD = "password-seguro";

  beforeAll(async () => {
    process.env.JWT_SECRET = "cobros-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "cobros-e2e-refresh-secret";
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
    cobroRepo = moduleFixture.get(getRepositoryToken(CobroPropietario));
    linkRepo = moduleFixture.get(getRepositoryToken(LinkPago));
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionPropietario));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajePropietario));

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
      usuario: "propietario-cb-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Ruiz",
      correo: "propietario-cb-1@correo.com",
      telefono: "+59173333331",
      codigo: "SC-CB-1",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioId = propietario.id;

    const gestor = await gestorRepo.save({
      propietario: { id: propietarioId },
      usuario: "gestor-cb-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "López",
      correo: "gestor-cb-1@correo.com",
      telefono: "+59173333332",
      codigo: "CB-CB-1",
      estatus: "activo",
    });
    gestorId = gestor.id;

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera Cobro",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;
  });

  afterAll(async () => {
    const cobros = await cobroRepo.find({ where: { propietario: { id: propietarioId } } });
    for (const cobro of cobros) {
      await linkRepo.delete({ cobroPropietario: { id: cobro.id } });
    }
    await cobroRepo.delete({ propietario: { id: propietarioId } });
    const conversaciones = await conversacionRepo.find({ where: { propietario: { id: propietarioId } } });
    for (const conversacion of conversaciones) {
      await mensajeRepo.delete({ conversacion: { id: conversacion.id } });
    }
    await conversacionRepo.delete({ propietario: { id: propietarioId } });
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ id: gestorId });
    await propietarioRepo.delete({ id: propietarioId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /cobros-propietario/generar crea el cobro con el monto calculado y su link mock", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobros-propietario/generar")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ propietarioId, periodo: "2026-08" });

    expect(res.status).toBe(201);
    expect(res.body.propietarioId).toBe(propietarioId);
    expect(res.body.periodo).toBe("2026-08");
    expect(res.body.montoCalculado).toBe(250);
    expect(res.body.estado).toBe("pendiente");

    const link = await linkRepo.findOne({ where: { cobroPropietario: { id: res.body.id } } });
    expect(link?.proveedor).toBe("mock");
    expect(link?.estado).toBe("generado");
  });

  it("POST /cobros-propietario/generar duplicado -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobros-propietario/generar")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ propietarioId, periodo: "2026-08" });

    expect(res.status).toBe(409);
  });

  it("POST /cobros-propietario/generar con periodo inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobros-propietario/generar")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ propietarioId, periodo: "agosto" });

    expect(res.status).toBe(400);
  });

  it("GET /cobros-propietario?propietarioId= filtra por propietario", async () => {
    const res = await request(app.getHttpServer())
      .get("/cobros-propietario")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .query({ propietarioId });

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].propietarioId).toBe(propietarioId);
  });

  it("GET /cobros-propietario/:id devuelve el detalle con propietario y link", async () => {
    const cobro = await cobroRepo.findOne({ where: { propietario: { id: propietarioId } } });

    const res = await request(app.getHttpServer())
      .get(`/cobros-propietario/${cobro!.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.propietario.moneda).toBe("BOB");
    expect(res.body.linkPago.estado).toBe("generado");
  });

  it("POST /cobros-propietario/:id/pago registra el pago y confirma por mensaje_propietario", async () => {
    const cobro = await cobroRepo.findOne({ where: { propietario: { id: propietarioId } } });

    const res = await request(app.getHttpServer())
      .post(`/cobros-propietario/${cobro!.id}/pago`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ montoPagado: 250, metodoPago: "transferencia" });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("pagado");
    expect(res.body.montoPagado).toBe(250);
    expect(res.body.metodoPago).toBe("transferencia");

    const link = await linkRepo.findOne({ where: { cobroPropietario: { id: cobro!.id } } });
    expect(link?.estado).toBe("pagado");

    const conversacion = await conversacionRepo.findOne({
      where: { propietario: { id: propietarioId }, estado: "activa" },
    });
    const mensajes = await mensajeRepo.find({
      where: { conversacion: { id: conversacion!.id } },
    });
    expect(mensajes.some((m) => m.subtipo === "confirmacion_pago")).toBe(true);
  });

  it("POST /cobros-propietario/:id/pago de un cobro ya pagado -> 400", async () => {
    const cobro = await cobroRepo.findOne({ where: { propietario: { id: propietarioId } } });

    const res = await request(app.getHttpServer())
      .post(`/cobros-propietario/${cobro!.id}/pago`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ montoPagado: 250, metodoPago: "transferencia" });

    expect(res.status).toBe(400);
  });

  it("GET /cobros-propietario como propietario -> 403 (admin-only)", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-cb-1", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get("/cobros-propietario")
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
  });

  it("POST /cobros-propietario/generar sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobros-propietario/generar")
      .send({ propietarioId, periodo: "2026-09" });

    expect(res.status).toBe(401);
  });
});