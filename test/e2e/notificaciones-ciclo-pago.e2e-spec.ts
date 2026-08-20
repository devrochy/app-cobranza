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
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Pago } from "../../src/modules/cartera/pago.entity";
import { Abono } from "../../src/modules/cartera/abono.entity";
import { NotificacionesService } from "../../src/modules/cartera/notificaciones.service";
import { RutaConfig } from "../../src/modules/rutas/ruta-config.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";
import { formatDate } from "../../src/common/date";

describe("Notificaciones de pago en ciclo completo (e2e)", () => {
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
  let conversacionRepo: Repository<ConversacionIa>;
  let mensajeRepo: Repository<MensajeIa>;
  let configRepo: Repository<RutaConfig>;
  let notificacionesService: NotificacionesService;
  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "ciclo-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Ciclo2026";
  const PASSWORD = "Socio#Ciclo2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-ciclo";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-ciclo";
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
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionIa));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeIa));
    configRepo = moduleFixture.get(getRepositoryToken(RutaConfig));
    notificacionesService = moduleFixture.get(NotificacionesService);

    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().where("cliente_id IN (SELECT id FROM clientes WHERE ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta CICLO'))").execute();
    await abonoRepo.createQueryBuilder().delete().where("cliente_id IN (SELECT id FROM clientes WHERE ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta CICLO'))").execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta CICLO'))").execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta CICLO')").execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta CICLO')").execute();
    await rutaRepo.delete({ nombre: "Ruta CICLO" });
    await cobradorRepo.delete({ codigo: "CB-CICLO-1" });
    await socioRepo.delete({ codigo: "SC-CICLO-1" });
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
      usuario: "socio-ciclo-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-ciclo-1@correo.com",
      telefono: "+59171160160",
      codigo: "SC-CICLO-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-ciclo-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-ciclo-1@correo.com",
      telefono: "+59172270160",
      codigo: "CB-CICLO-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta CICLO",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
      });
    rutaId = rutaRes.body.id as number;

    // Config de notificación: aviso del día de cobro activo, umbral de mora 1.
    await request(app.getHttpServer())
      .put(`/rutas/${rutaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ avisoDiaCobro: true, umbralMoraNotificacion: 1 });

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ciclo",
        apellido: "Cliente",
        negocio: "N",
        telefonoWhatsapp: "+59171160161",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    // Préstamo con cuota 1 que vence hoy (para el aviso de día de cobro).
    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
    const cuota1 = await cuotaRepo.findOne({
      where: { prestamo: { cliente: { id: clienteId } }, numeroCuota: 1 },
    });
    if (cuota1) {
      await cuotaRepo.update(cuota1.id, { fechaVencimiento: formatDate(new Date()) });
    }
  });

  afterAll(async () => {
    await mensajeRepo.createQueryBuilder().delete().execute();
    await conversacionRepo.createQueryBuilder().delete().execute();
    if (rutaId) {
      await pagoRepo.createQueryBuilder().delete().where("cliente_id IN (SELECT id FROM clientes WHERE ruta_id = :rutaId)", { rutaId }).execute();
      await abonoRepo.createQueryBuilder().delete().where("cliente_id IN (SELECT id FROM clientes WHERE ruta_id = :rutaId)", { rutaId }).execute();
      await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id = :rutaId)", { rutaId }).execute();
      await prestamoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
      await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
      await rutaRepo.delete({ id: rutaId });
    }
    await cobradorRepo.delete({ codigo: "CB-CICLO-1" });
    await socioRepo.delete({ codigo: "SC-CICLO-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("ejecutarAvisoDiaCobro envía aviso y persiste en mensajes_ia", async () => {
    const enviadas = await notificacionesService.ejecutarAvisoDiaCobro(rutaId, { hoy: new Date() });
    expect(enviadas).toBe(1);

    const mensaje = await mensajeRepo.findOne({
      where: { intencionDetectada: "aviso_dia_cobro" },
      order: { id: "DESC" },
    });
    expect(mensaje).toBeDefined();
    expect(mensaje?.contenido).toContain("vence hoy");
  });

  it("registrar un pago genera la confirmación en mensajes_ia", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { cliente: { id: clienteId } }, numeroCuota: 1 },
    });
    expect(cuota).toBeDefined();

    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: cuota!.id, valor: cuota!.valorEsperado, metodoPago: "efectivo" });

    const confirmacion = await mensajeRepo.findOne({
      where: { intencionDetectada: "confirmacion_pago" },
      order: { id: "DESC" },
    });
    expect(confirmacion).toBeDefined();
    expect(confirmacion?.contenido).toContain("confirmamos");
  });

  it("config expone los campos de notificación", async () => {
    const config = await configRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(config?.avisoDiaCobro).toBe(true);
    expect(config?.umbralMoraNotificacion).toBe(1);
    expect(config?.diasAnticipacionNotificacion).toBeDefined();
  });
});