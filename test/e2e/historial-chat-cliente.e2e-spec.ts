import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { ConversacionIa } from "../../src/modules/clientes/conversacion-ia.entity";
import { MensajeIa } from "../../src/modules/clientes/mensaje-ia.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Historial de conversación y chat con el cliente (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let conversacionRepo: Repository<ConversacionIa>;
  let mensajeRepo: Repository<MensajeIa>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "chat-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Chat2026";
  const PASSWORD = "Propietario#Chat2026";

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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionIa));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeIa));

    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id IN (SELECT id FROM carteras WHERE nombre = 'Cartera CHAT')").execute();
    await carteraRepo.delete({ nombre: "Cartera CHAT" });
    await gestorRepo.delete({ codigo: "CB-CHAT-1" });
    await propietarioRepo.delete({ codigo: "SC-CHAT-1" });
    await propietarioRepo.delete({ codigo: "SC-CHAT-2" });
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
      usuario: "propietario-chat-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-chat-1@correo.com",
      telefono: "+59171160170",
      codigo: "SC-CHAT-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-chat-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-chat-1@correo.com",
      telefono: "+59172270170",
      codigo: "CB-CHAT-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera CHAT",
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
        nombre: "Chat",
        apellido: "Cliente",
        negocio: "N",
        telefonoWhatsapp: "+59171160171",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;
  });

  afterAll(async () => {
    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-CHAT-1" });
    await propietarioRepo.delete({ codigo: "SC-CHAT-1" });
    await propietarioRepo.delete({ codigo: "SC-CHAT-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST .../conversacion/mensajes con contenido vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes/${clienteId}/conversacion/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "" });

    expect(res.status).toBe(400);
  });

  it("POST .../conversacion/mensajes envía el mensaje del agente y lo persiste", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes/${clienteId}/conversacion/mensajes`)
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
      .get(`/carteras/${carteraId}/clientes/${clienteId}/conversacion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.waMe).toBe("https://wa.me/59171160171");
    expect(Array.isArray(res.body.mensajes)).toBe(true);
    expect(res.body.mensajes.some((m: { emisor: string }) => m.emisor === "agente")).toBe(true);
  });

  it("GET .../conversacion con cliente inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/999999/conversacion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET .../conversacion sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/conversacion`);

    expect(res.status).toBe(401);
  });

  it("un propietario SIN ver_reportes no puede ver el historial -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-chat-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-chat-2@correo.com",
      telefono: "+59171160172",
      codigo: "SC-CHAT-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-chat-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/conversacion`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});