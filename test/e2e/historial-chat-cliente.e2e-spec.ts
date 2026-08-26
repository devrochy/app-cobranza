import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { ConversacionIa } from "../../src/modules/cartera/conversacion-ia.entity";
import { MensajeIa } from "../../src/modules/cartera/mensaje-ia.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Historial de conversación y chat con el cliente (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let conversacionRepo: Repository<ConversacionIa>;
  let mensajeRepo: Repository<MensajeIa>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "chat-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Chat2026";
  const PASSWORD = "Socio#Chat2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-chat";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-chat";
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
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionIa));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeIa));

    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta CHAT')").execute();
    await rutaRepo.delete({ nombre: "Ruta CHAT" });
    await cobradorRepo.delete({ codigo: "CB-CHAT-1" });
    await socioRepo.delete({ codigo: "SC-CHAT-1" });
    await socioRepo.delete({ codigo: "SC-CHAT-2" });
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
      usuario: "socio-chat-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-chat-1@correo.com",
      telefono: "+59171160170",
      codigo: "SC-CHAT-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-chat-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-chat-1@correo.com",
      telefono: "+59172270170",
      codigo: "CB-CHAT-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta CHAT",
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
        nombre: "Chat",
        apellido: "Cliente",
        negocio: "N",
        telefonoWhatsapp: "+59171160171",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;
  });

  afterAll(async () => {
    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-CHAT-1" });
    await socioRepo.delete({ codigo: "SC-CHAT-1" });
    await socioRepo.delete({ codigo: "SC-CHAT-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST .../conversacion/mensajes con contenido vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes/${clienteId}/conversacion/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "" });

    expect(res.status).toBe(400);
  });

  it("POST .../conversacion/mensajes envía el mensaje del agente y lo persiste", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes/${clienteId}/conversacion/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "Estimado, por favor regularice su pago" });

    expect(res.status).toBe(201);
    expect(res.body.emisor).toBe("agente");

    const enDb = await mensajeRepo.findOne({ where: { emisor: "agente" }, order: { id: "DESC" } });
    expect(enDb).toBeDefined();
    expect(enDb?.contenido).toContain("regularice");
  });

  it("GET .../conversacion devuelve el historial y el enlace wa.me", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/clientes/${clienteId}/conversacion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.waMe).toBe("https://wa.me/59171160171");
    expect(Array.isArray(res.body.mensajes)).toBe(true);
    expect(res.body.mensajes.some((m: { emisor: string }) => m.emisor === "agente")).toBe(true);
  });

  it("GET .../conversacion con cliente inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/clientes/999999/conversacion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET .../conversacion sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/clientes/${clienteId}/conversacion`);

    expect(res.status).toBe(401);
  });

  it("un socio SIN ver_reportes no puede ver el historial -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-chat-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-chat-2@correo.com",
      telefono: "+59171160172",
      codigo: "SC-CHAT-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-chat-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/clientes/${clienteId}/conversacion`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});