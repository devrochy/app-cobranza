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
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Infraestructura de WhatsApp y notificaciones (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let conversacionRepo: Repository<ConversacionIa>;
  let mensajeRepo: Repository<MensajeIa>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "whats-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Whats2026";
  const PASSWORD = "Propietario#Whats2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-whats";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-whats";
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
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionIa));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeIa));

    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id IN (SELECT id FROM carteras WHERE nombre = 'Cartera WHATS'))").execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id IN (SELECT id FROM carteras WHERE nombre = 'Cartera WHATS')").execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id IN (SELECT id FROM carteras WHERE nombre = 'Cartera WHATS')").execute();
    await carteraRepo.delete({ nombre: "Cartera WHATS" });
    await gestorRepo.delete({ codigo: "CB-WHATS-1" });
    await propietarioRepo.delete({ codigo: "SC-WHATS-1" });
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
      usuario: "propietario-whats-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-whats-1@correo.com",
      telefono: "+59171160150",
      codigo: "SC-WHATS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-whats-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-whats-1@correo.com",
      telefono: "+59172270150",
      codigo: "CB-WHATS-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera WHATS",
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
        nombre: "Whats",
        apellido: "Cliente",
        negocio: "N",
        telefonoWhatsapp: "+59171160151",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
  });

  afterAll(async () => {
    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id = :carteraId)", { carteraId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-WHATS-1" });
    await propietarioRepo.delete({ codigo: "SC-WHATS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /whatsapp/simulado/recibir sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .send({ conversacionId: 1, contenido: "sin token" });

    expect(res.status).toBe(401);
  });

  it("POST /whatsapp/simulado/recibir persiste el mensaje del cliente en mensajes_ia", async () => {
    const conversacion = await conversacionRepo.save({
      cliente: { id: clienteId } as Cliente,
      clienteId,
      canal: "whatsapp",
      estado: "activa",
      motivoDerivacion: null,
      agenteAsignadoId: null,
      closedAt: null,
    });

    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ conversacionId: conversacion.id, contenido: "¿Cuál es mi saldo?" });

    expect(res.status).toBe(201);
    expect(res.body.emisor).toBe("cliente");

    const enDb = await mensajeRepo.findOne({
      where: { conversacion: { id: conversacion.id }, emisor: "cliente" },
    });
    expect(enDb).toBeDefined();
    expect(enDb?.contenido).toBe("¿Cuál es mi saldo?");
  });

  it("cartera_config expone los campos de notificación", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("diasAnticipacionNotificacion");
    expect(res.body).toHaveProperty("avisoDiaCobro");
    expect(res.body).toHaveProperty("umbralMoraNotificacion");
  });
});