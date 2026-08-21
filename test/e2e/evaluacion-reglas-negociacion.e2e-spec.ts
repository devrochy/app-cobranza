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
import { ReglaNegociacionIa } from "../../src/modules/reglas-negociacion-ia/regla-negociacion-ia.entity";
import { AppModule } from "../../src/app.module";

describe("Evaluación de negociaciones contra las reglas (e2e, HU-31)", () => {
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
  let reglasRepo: Repository<ReglaNegociacionIa>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;
  let prestamoId: number;
  let conversacionId: number;

  const ADMIN_USERNAME = "eval-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Eval2026";
  const PASSWORD = "Socio#Eval2026";

  const REGLAS_BASE = {
    maxDiasProrroga: 0,
    minAbonoAceptablePct: 0,
    maxReprogramacionesPorCliente: 0,
    umbralSaldoAutonomo: 0,
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-eval";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-eval";
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
    reglasRepo = moduleFixture.get(getRepositoryToken(ReglaNegociacionIa));

    await mensajeRepo.createQueryBuilder().delete().execute();
    await promesaRepo.createQueryBuilder().delete().execute();
    await reglasRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta EVAL'))").execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta EVAL')").execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta EVAL')").execute();
    await rutaRepo.delete({ nombre: "Ruta EVAL" });
    await cobradorRepo.delete({ codigo: "CB-EVAL-1" });
    await socioRepo.delete({ codigo: "SC-EVAL-1" });
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
      usuario: "socio-eval-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-eval-1@correo.com",
      telefono: "+59171160150",
      codigo: "SC-EVAL-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-eval-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-eval-1@correo.com",
      telefono: "+59172270150",
      codigo: "CB-EVAL-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta EVAL",
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
        nombre: "Eval",
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
    await reglasRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id = :rutaId)", { rutaId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-EVAL-1" });
    await socioRepo.delete({ codigo: "SC-EVAL-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("rechaza la negociación y no persiste cuando excede min_abono_aceptable_pct", async () => {
    await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...REGLAS_BASE, minAbonoAceptablePct: 90 });

    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ conversacionId, contenido: "puedo abonar 10 el viernes" });

    expect(res.status).toBe(201);

    const rechazada = await promesaRepo.findOne({
      where: { prestamo: { id: prestamoId }, tipo: "abono_parcial", valorPrometido: 10 },
    });
    expect(rechazada).toBeNull();

    const respuesta = await mensajeRepo.findOne({
      where: { conversacion: { id: conversacionId }, intencionDetectada: "promesa_pago_rechazada" },
      order: { id: "DESC" },
    });
    expect(respuesta).toBeDefined();
    expect(respuesta?.contenido.toLowerCase()).toContain("límites");
  });

  it("persiste la negociación cuando cumple las reglas", async () => {
    await request(app.getHttpServer())
      .put("/reglas-negociacion-ia")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(REGLAS_BASE);

    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ conversacionId, contenido: "puedo abonar 220 el viernes" });

    expect(res.status).toBe(201);

    const promesa = await promesaRepo.findOne({
      where: { prestamo: { id: prestamoId }, tipo: "abono_parcial", valorPrometido: 220 },
      order: { id: "DESC" },
    });
    expect(promesa).toBeDefined();
    expect(promesa?.estado).toBe("pendiente");
  });
});