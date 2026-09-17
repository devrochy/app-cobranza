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
import { PromesaPago } from "../../src/modules/clientes/promesa-pago.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { ReglaNegociacionIa } from "../../src/modules/reglas-negociacion-ia/regla-negociacion-ia.entity";
import { AppModule } from "../../src/app.module";

describe("Detección y derivación a agente humano (e2e, HU-32)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let promesaRepo: Repository<PromesaPago>;
  let conversacionRepo: Repository<ConversacionIa>;
  let mensajeRepo: Repository<MensajeIa>;
  let reglasRepo: Repository<ReglaNegociacionIa>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;
  let conversacionId: number;

  const ADMIN_USERNAME = "deriv-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Deriv2026";
  const PASSWORD = "Propietario#Deriv2026";

  const REGLAS_BASE = {
    maxDiasProrroga: 0,
    minAbonoAceptablePct: 0,
    maxReprogramacionesPorCliente: 0,
    umbralSaldoAutonomo: 0,
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-deriv";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-deriv";
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
    promesaRepo = moduleFixture.get(getRepositoryToken(PromesaPago));
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionIa));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeIa));
    reglasRepo = moduleFixture.get(getRepositoryToken(ReglaNegociacionIa));

    await mensajeRepo.createQueryBuilder().delete().execute();
    await promesaRepo.createQueryBuilder().delete().execute();
    await reglasRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id IN (SELECT id FROM carteras WHERE nombre = 'Cartera DERIV'))").execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id IN (SELECT id FROM carteras WHERE nombre = 'Cartera DERIV')").execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id IN (SELECT id FROM carteras WHERE nombre = 'Cartera DERIV')").execute();
    await carteraRepo.delete({ nombre: "Cartera DERIV" });
    await gestorRepo.delete({ codigo: "CB-DERIV-1" });
    await propietarioRepo.delete({ codigo: "SC-DERIV-1" });
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
      usuario: "propietario-deriv-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-deriv-1@correo.com",
      telefono: "+59171160150",
      codigo: "SC-DERIV-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-deriv-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-deriv-1@correo.com",
      telefono: "+59172270150",
      codigo: "CB-DERIV-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera DERIV",
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
        nombre: "Deriv",
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
      .send({ clienteId, valor: 400, numCuotas: 2, diasEntreCuotas: 7 });

    const conversacion = await conversacionRepo.save({
      cliente: { id: clienteId } as Cliente,
      clienteId,
      canal: "whatsapp",
      estado: "activa",
      motivoDerivacion: null,
      agenteAsignadoId: null,
      closedAt: null,
    });
    conversacionId = conversacion.id;
  });

  afterAll(async () => {
    await mensajeRepo.createQueryBuilder().delete().execute();
    await promesaRepo.createQueryBuilder().delete().execute();
    await reglasRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id = :carteraId)", { carteraId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-DERIV-1" });
    await propietarioRepo.delete({ codigo: "SC-DERIV-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("deriva la conversación cuando el cliente solicita atención humana", async () => {
    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ conversacionId, contenido: "quiero hablar con un agente" });

    expect(res.status).toBe(201);

    const conversacion = await conversacionRepo.findOne({ where: { id: conversacionId } });
    expect(conversacion?.estado).toBe("derivada");
    expect(conversacion?.motivoDerivacion).toBe("solicitud_agente");

    const respuesta = await mensajeRepo.findOne({
      where: { conversacion: { id: conversacionId }, intencionDetectada: "derivacion" },
      order: { id: "DESC" },
    });
    expect(respuesta).toBeDefined();
    expect(respuesta?.contenido.toLowerCase()).toContain("agente");
  });

  it("deriva la negociación cuando el saldo supera el umbral de decisión autónoma", async () => {
    await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...REGLAS_BASE, umbralSaldoAutonomo: 10 });

    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ conversacionId, contenido: "pago el viernes" });

    expect(res.status).toBe(201);

    const promesa = await promesaRepo.findOne({
      where: { conversacion: { id: conversacionId }, creadoPor: "ia" },
      order: { id: "DESC" },
    });
    expect(promesa).toBeNull();

    const conversacion = await conversacionRepo.findOne({ where: { id: conversacionId } });
    expect(conversacion?.estado).toBe("derivada");
    expect(conversacion?.motivoDerivacion).toBe("saldo_supera_umbral");
  });
});