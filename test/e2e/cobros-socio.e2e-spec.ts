import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { CobroSocio } from "../../src/modules/cobros-socio/cobro-socio.entity";
import { ConversacionSocio } from "../../src/modules/cobros-socio/conversacion-socio.entity";
import { LinkPago } from "../../src/modules/cobros-socio/link-pago.entity";
import { MensajeSocio } from "../../src/modules/cobros-socio/mensaje-socio.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Cobro mensual a socios (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let cobroRepo: Repository<CobroSocio>;
  let linkRepo: Repository<LinkPago>;
  let conversacionRepo: Repository<ConversacionSocio>;
  let mensajeRepo: Repository<MensajeSocio>;
  let accessTokenAdmin: string;
  let socioId: number;
  let cobradorId: number;
  let rutaId: number;

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    cobroRepo = moduleFixture.get(getRepositoryToken(CobroSocio));
    linkRepo = moduleFixture.get(getRepositoryToken(LinkPago));
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionSocio));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeSocio));

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
      usuario: "socio-cb-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Ruiz",
      correo: "socio-cb-1@correo.com",
      telefono: "+59173333331",
      codigo: "SC-CB-1",
      moneda: "BOB",
      estatus: "activo",
    });
    socioId = socio.id;

    const cobrador = await cobradorRepo.save({
      socio: { id: socioId },
      usuario: "cobrador-cb-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "López",
      correo: "cobrador-cb-1@correo.com",
      telefono: "+59173333332",
      codigo: "CB-CB-1",
      estatus: "activo",
    });
    cobradorId = cobrador.id;

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta Cobro",
        socioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;
  });

  afterAll(async () => {
    const cobros = await cobroRepo.find({ where: { socio: { id: socioId } } });
    for (const cobro of cobros) {
      await linkRepo.delete({ cobroSocio: { id: cobro.id } });
    }
    await cobroRepo.delete({ socio: { id: socioId } });
    const conversaciones = await conversacionRepo.find({ where: { socio: { id: socioId } } });
    for (const conversacion of conversaciones) {
      await mensajeRepo.delete({ conversacion: { id: conversacion.id } });
    }
    await conversacionRepo.delete({ socio: { id: socioId } });
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ id: cobradorId });
    await socioRepo.delete({ id: socioId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /cobros-socio/generar crea el cobro con el monto calculado y su link mock", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobros-socio/generar")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ socioId, periodo: "2026-08" });

    expect(res.status).toBe(201);
    expect(res.body.socioId).toBe(socioId);
    expect(res.body.periodo).toBe("2026-08");
    expect(res.body.montoCalculado).toBe(250);
    expect(res.body.estado).toBe("pendiente");

    const link = await linkRepo.findOne({ where: { cobroSocio: { id: res.body.id } } });
    expect(link?.proveedor).toBe("mock");
    expect(link?.estado).toBe("generado");
  });

  it("POST /cobros-socio/generar duplicado -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobros-socio/generar")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ socioId, periodo: "2026-08" });

    expect(res.status).toBe(409);
  });

  it("POST /cobros-socio/generar con periodo inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobros-socio/generar")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ socioId, periodo: "agosto" });

    expect(res.status).toBe(400);
  });

  it("GET /cobros-socio?socioId= filtra por socio", async () => {
    const res = await request(app.getHttpServer())
      .get("/cobros-socio")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .query({ socioId });

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].socioId).toBe(socioId);
  });

  it("GET /cobros-socio/:id devuelve el detalle con socio y link", async () => {
    const cobro = await cobroRepo.findOne({ where: { socio: { id: socioId } } });

    const res = await request(app.getHttpServer())
      .get(`/cobros-socio/${cobro!.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.socio.moneda).toBe("BOB");
    expect(res.body.linkPago.estado).toBe("generado");
  });

  it("POST /cobros-socio/:id/pago registra el pago y confirma por mensaje_socio", async () => {
    const cobro = await cobroRepo.findOne({ where: { socio: { id: socioId } } });

    const res = await request(app.getHttpServer())
      .post(`/cobros-socio/${cobro!.id}/pago`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ montoPagado: 250, metodoPago: "transferencia" });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("pagado");
    expect(res.body.montoPagado).toBe(250);
    expect(res.body.metodoPago).toBe("transferencia");

    const link = await linkRepo.findOne({ where: { cobroSocio: { id: cobro!.id } } });
    expect(link?.estado).toBe("pagado");

    const conversacion = await conversacionRepo.findOne({
      where: { socio: { id: socioId }, estado: "activa" },
    });
    const mensajes = await mensajeRepo.find({
      where: { conversacion: { id: conversacion!.id } },
    });
    expect(mensajes.some((m) => m.subtipo === "confirmacion_pago")).toBe(true);
  });

  it("POST /cobros-socio/:id/pago de un cobro ya pagado -> 400", async () => {
    const cobro = await cobroRepo.findOne({ where: { socio: { id: socioId } } });

    const res = await request(app.getHttpServer())
      .post(`/cobros-socio/${cobro!.id}/pago`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ montoPagado: 250, metodoPago: "transferencia" });

    expect(res.status).toBe(400);
  });

  it("GET /cobros-socio como socio -> 403 (admin-only)", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-cb-1", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get("/cobros-socio")
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
  });

  it("POST /cobros-socio/generar sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/cobros-socio/generar")
      .send({ socioId, periodo: "2026-09" });

    expect(res.status).toBe(401);
  });
});