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
import { PromesaPago } from "../../src/modules/cartera/promesa-pago.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Registro de promesa de pago por WhatsApp (e2e, HU-28)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let promesaRepo: Repository<PromesaPago>;
  let conversacionRepo: Repository<ConversacionIa>;
  let mensajeRepo: Repository<MensajeIa>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;
  let prestamoId: number;
  let conversacionId: number;

  const ADMIN_USERNAME = "promesa-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Promesa2026";
  const PASSWORD = "Socio#Promesa2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-promesa";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-promesa";
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
    promesaRepo = moduleFixture.get(getRepositoryToken(PromesaPago));
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionIa));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeIa));

    await mensajeRepo.createQueryBuilder().delete().execute();
    await promesaRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta PROMESA'))").execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta PROMESA')").execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta PROMESA')").execute();
    await rutaRepo.delete({ nombre: "Ruta PROMESA" });
    await cobradorRepo.delete({ codigo: "CB-PROMESA-1" });
    await socioRepo.delete({ codigo: "SC-PROMESA-1" });
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
      usuario: "socio-promesa-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-promesa-1@correo.com",
      telefono: "+59171160150",
      codigo: "SC-PROMESA-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-promesa-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-promesa-1@correo.com",
      telefono: "+59172270150",
      codigo: "CB-PROMESA-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta PROMESA",
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
        nombre: "Promesa",
        apellido: "Cliente",
        negocio: "N",
        telefonoWhatsapp: "+59171160151",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId, valor: 400, numCuotas: 2, diasEntreCuotas: 7 });
    prestamoId = prestamoRes.body.id as number;

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
    await conversacionRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id = :rutaId)", { rutaId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-PROMESA-1" });
    await socioRepo.delete({ codigo: "SC-PROMESA-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("registra la promesa de pago y confirma por WhatsApp", async () => {
    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ conversacionId, contenido: "pago el viernes" });

    expect(res.status).toBe(201);

    const promesa = await promesaRepo.findOne({
      where: { prestamo: { id: prestamoId }, creadoPor: "ia" },
      order: { id: "DESC" },
    });
    expect(promesa).toBeDefined();
    expect(promesa?.estado).toBe("pendiente");
    expect(promesa?.conversacionId).toBe(conversacionId);
    expect(promesa?.fechaPrometida).toBeDefined();

    const respuesta = await mensajeRepo.findOne({
      where: { conversacion: { id: conversacionId }, emisor: "ia", intencionDetectada: "promesa_pago" },
      order: { id: "DESC" },
    });
    expect(respuesta).toBeDefined();
    expect(respuesta?.contenido.toLowerCase()).toContain("promesa");
  });

  it("pide aclaración y no registra la promesa cuando no hay fecha", async () => {
    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ conversacionId, contenido: "quiero pagar" });

    expect(res.status).toBe(201);

    const respuesta = await mensajeRepo.findOne({
      where: { conversacion: { id: conversacionId }, emisor: "ia", intencionDetectada: "promesa_pago_clarificacion" },
      order: { id: "DESC" },
    });
    expect(respuesta).toBeDefined();
    expect(respuesta?.contenido.toLowerCase()).toContain("día");
  });
});
