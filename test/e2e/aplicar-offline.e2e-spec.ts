import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Abono } from "../../src/modules/cartera/abono.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Pago } from "../../src/modules/cartera/pago.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Visita } from "../../src/modules/cartera/visita.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { CobradorPermiso } from "../../src/modules/cobradores/cobrador-permiso.entity";
import { Gasto } from "../../src/modules/rutas/gasto.entity";
import { GastoEvidencia } from "../../src/modules/rutas/gasto-evidencia.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Device } from "../../src/modules/sincronizacion-offline/device.entity";
import { SincronizacionOffline } from "../../src/modules/sincronizacion-offline/sincronizacion-offline.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";
import { DEVICE_API_KEY_HEADER } from "../../src/modules/sincronizacion-offline/device-api-key.guard";

describe("Aplicar eventos offline al dominio (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let cobradorPermisoRepo: Repository<CobradorPermiso>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let abonoRepo: Repository<Abono>;
  let visitaRepo: Repository<Visita>;
  let gastoRepo: Repository<Gasto>;
  let evidenciaRepo: Repository<GastoEvidencia>;
  let deviceRepo: Repository<Device>;
  let syncRepo: Repository<SincronizacionOffline>;

  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;
  let prestamoId: number;
  let deviceKey: string;

  const ADMIN_USERNAME = "offline-e2e-admin";
  const ADMIN_PASSWORD = "offline-e2e-password";
  const PASSWORD = "password-seguro";
  const DEVICE_CODIGO = "11111111-2222-4333-8444-555555555555";
  const DEVICE_SECRETO = "e2e-device-secreto";

  beforeAll(async () => {
    process.env.JWT_SECRET = "offline-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "offline-e2e-refresh-secret";
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
    cobradorPermisoRepo = moduleFixture.get(getRepositoryToken(CobradorPermiso));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));
    pagoRepo = moduleFixture.get(getRepositoryToken(Pago));
    abonoRepo = moduleFixture.get(getRepositoryToken(Abono));
    visitaRepo = moduleFixture.get(getRepositoryToken(Visita));
    gastoRepo = moduleFixture.get(getRepositoryToken(Gasto));
    evidenciaRepo = moduleFixture.get(getRepositoryToken(GastoEvidencia));
    deviceRepo = moduleFixture.get(getRepositoryToken(Device));
    syncRepo = moduleFixture.get(getRepositoryToken(SincronizacionOffline));

    await syncRepo.createQueryBuilder().delete().execute();
    await deviceRepo.delete({ codigo: DEVICE_CODIGO });
    await evidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await visitaRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-OFFLINE-1" });
    await socioRepo.delete({ codigo: "SC-OFFLINE-1" });
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
      usuario: "socio-offline-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-offline-1@correo.com",
      telefono: "+59175550001",
      codigo: "SC-OFFLINE-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-offline-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-offline-1@correo.com",
      telefono: "+59176660001",
      codigo: "CB-OFFLINE-1",
      estatus: "activo",
    });

    await cobradorPermisoRepo.save([
      { cobrador: { id: cobrador.id }, permiso: "registrar_pago", habilitado: true },
      { cobrador: { id: cobrador.id }, permiso: "registrar_no_pago", habilitado: true },
      { cobrador: { id: cobrador.id }, permiso: "registrar_gasto", habilitado: true },
    ]);

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta OFFLINE",
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
        nombre: "Juan",
        apellido: "Offline",
        negocio: "Tienda",
        telefonoWhatsapp: "+59175550002",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        clienteId,
        valor: 1000,
        numCuotas: 4,
        diasEntreCuotas: 7,
      });
    prestamoId = prestamoRes.body.id as number;

    await deviceRepo.save({
      codigo: DEVICE_CODIGO,
      apiKeyHash: await bcrypt.hash(DEVICE_SECRETO, 4),
      cobradorId: cobrador.id,
      rutaId,
      estado: "activo",
      fechaVinculacion: new Date(),
    });
    deviceKey = `${DEVICE_CODIGO}.${DEVICE_SECRETO}`;
  });

  afterAll(async () => {
    await syncRepo.createQueryBuilder().delete().execute();
    await deviceRepo.delete({ codigo: DEVICE_CODIGO });
    await evidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await visitaRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.delete({ id: prestamoId });
    await clienteRepo.delete({ id: clienteId });
    await rutaRepo.delete({ id: rutaId });
    // CobradorPermiso se borra en cascada con el cobrador (onDelete: CASCADE).
    await cobradorRepo.delete({ codigo: "CB-OFFLINE-1" });
    await socioRepo.delete({ codigo: "SC-OFFLINE-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("aplica una visita de pago offline y marca la cuota como pagada", async () => {
    const cuota = await cuotaRepo.findOne({
      where: { prestamo: { id: prestamoId }, numeroCuota: 1 },
    });

    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set(DEVICE_API_KEY_HEADER, deviceKey)
      .send({
        eventos: [
          {
            eventoIdCliente: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
            tipoEvento: "visita",
            payload: {
              prestamoId,
              clienteId,
              resultado: "pago",
              tipoPago: "cuota",
              cuotaId: cuota!.id,
              valor: cuota!.valorEsperado,
              metodoPago: "efectivo",
            },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual([
      { eventoIdCliente: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", estado: "sincronizado" },
    ]);

    const cuotaActualizada = await cuotaRepo.findOne({ where: { id: cuota!.id } });
    expect(cuotaActualizada?.estatus).toBe("pagada");

    const guardado = await syncRepo.findOne({
      where: { eventoIdCliente: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" },
    });
    expect(guardado?.estado).toBe("sincronizado");
  });

  it("no re-aplica un evento duplicado (mismo eventoIdCliente)", async () => {
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set(DEVICE_API_KEY_HEADER, deviceKey)
      .send({
        eventos: [
          {
            eventoIdCliente: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
            tipoEvento: "visita",
            payload: { prestamoId, clienteId, resultado: "no_pago", motivoNoPago: "no_esta" },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual([
      { eventoIdCliente: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", estado: "duplicado" },
    ]);
  });

  it("aplica un gasto offline con evidencia base64", async () => {
    const base64 = Buffer.from("evidencia").toString("base64");
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set(DEVICE_API_KEY_HEADER, deviceKey)
      .send({
        eventos: [
          {
            eventoIdCliente: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
            tipoEvento: "gasto",
            payload: {
              descripcion: "Combustible offline",
              valor: 50,
              evidencias: [
                { nombre: "e.jpg", mimetype: "image/jpeg", base64 },
              ],
            },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body[0].estado).toBe("sincronizado");

    const gasto = await gastoRepo.findOne({
      where: { ruta: { id: rutaId }, descripcion: "Combustible offline" },
    });
    expect(gasto).toBeDefined();
    const evidencias = await evidenciaRepo.find({ where: { gasto: { id: gasto!.id } } });
    expect(evidencias.length).toBe(1);
  });

  it("marca error con motivo cuando el payload de la visita es inválido", async () => {
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set(DEVICE_API_KEY_HEADER, deviceKey)
      .send({
        eventos: [
          {
            eventoIdCliente: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
            tipoEvento: "visita",
            payload: {},
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body[0].estado).toBe("sincronizado");

    const guardado = await syncRepo.findOne({
      where: { eventoIdCliente: "cccccccc-cccc-4ccc-8ccc-cccccccccc01" },
    });
    expect(guardado?.estado).toBe("error");
    expect(guardado?.errorMotivo).toBeTruthy();
  });
});