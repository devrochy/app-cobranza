import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Device } from "../../src/modules/sincronizacion-offline/device.entity";
import { SincronizacionOffline } from "../../src/modules/sincronizacion-offline/sincronizacion-offline.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Gasto } from "../../src/modules/rutas/gasto.entity";
import { GastoEvidencia } from "../../src/modules/rutas/gasto-evidencia.entity";
import { Socio } from "../../src/modules/socios/socio.entity";

describe("Sincronización offline (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let deviceRepo: Repository<Device>;
  let syncRepo: Repository<SincronizacionOffline>;
  let gastoRepo: Repository<Gasto>;
  let evidenciaRepo: Repository<GastoEvidencia>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let apiKey: string;
  let deviceId: number;

  const ADMIN_USERNAME = "sync-e2e-admin";
  const ADMIN_PASSWORD = "sync-e2e-password";
  const PASSWORD = "password-seguro";
  const UUID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const UUID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeAll(async () => {
    process.env.JWT_SECRET = "sync-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "sync-e2e-refresh-secret";
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
    deviceRepo = moduleFixture.get(getRepositoryToken(Device));
    syncRepo = moduleFixture.get(getRepositoryToken(SincronizacionOffline));
    gastoRepo = moduleFixture.get(getRepositoryToken(Gasto));
    evidenciaRepo = moduleFixture.get(getRepositoryToken(GastoEvidencia));

    // Orden seguro por FK: primero cobradores, luego socios (si un run previo
    // dejó el cobrador, borrarlo antes evita violar la FK de socio).
    await cobradorRepo.delete({ codigo: "CB-SYNC-1" });
    await socioRepo.delete({ codigo: "SC-SYNC-1" });
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
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    accessTokenAdmin = login.body.accessToken as string;

    const socio = await socioRepo.save({
      usuario: "socio-sync-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Sync",
      correo: "socio-sync-1@correo.com",
      telefono: "+59171160060",
      codigo: "SC-SYNC-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-sync-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "Sync",
      correo: "cobrador-sync-1@correo.com",
      telefono: "+59172260060",
      codigo: "CB-SYNC-1",
      estatus: "activo",
    });
    const ruta = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta SYNC-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      costoCobro: 250,
      estatus: "activo",
    });
    rutaId = ruta.id;

    await deviceRepo.delete({ rutaId });
  });

  afterAll(async () => {
    if (deviceId) {
      await syncRepo.delete({ dispositivo: { id: deviceId } });
    }
    // El on-ingest aplica el evento `gasto` de prueba → limpiar gastos/evidencias
    // antes de borrar la ruta (FK).
    await evidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await deviceRepo.delete({ rutaId });
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-SYNC-1" });
    await socioRepo.delete({ codigo: "SC-SYNC-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /devices (admin) registra un dispositivo y devuelve la API key", async () => {
    const res = await request(app.getHttpServer())
      .post("/devices")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ rutaId });

    expect(res.status).toBe(201);
    expect(res.body.codigo).toBeDefined();
    expect(res.body.apiKey).toContain(".");
    expect(res.body.rutaId).toBe(rutaId);
    apiKey = res.body.apiKey as string;
    deviceId = res.body.codigo ? (await deviceRepo.findOne({ where: { codigo: res.body.codigo } }))!.id : 0;
  });

  it("POST /devices sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).post("/devices").send({ rutaId });
    expect(res.status).toBe(401);
  });

  it("POST /sync-offline/eventos ingiere eventos (ack) y los deja listos para aplicar", async () => {
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set("x-device-key", apiKey)
      .send({
        eventos: [
          { eventoIdCliente: UUID_A, tipoEvento: "visita", payload: { resultado: "pago", monto: 250 } },
          { eventoIdCliente: UUID_B, tipoEvento: "gasto", payload: { descripcion: "gasolina", valor: 50 } },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual([
      { eventoIdCliente: UUID_A, estado: "sincronizado" },
      { eventoIdCliente: UUID_B, estado: "sincronizado" },
    ]);

    const fila = await syncRepo.findOne({ where: { dispositivo: { id: deviceId }, eventoIdCliente: UUID_A } });
    // On-ingest: el evento se ingiere (ack) y luego se intenta aplicar al dominio.
    // Este payload de prueba no tiene préstamo válido → queda en `error` con motivo.
    expect(fila?.estado).toBe("error");
    expect(fila?.errorMotivo).toBeTruthy();
    expect((fila?.payloadJson as { resultado: string }).resultado).toBe("pago");
  });

  it("re-enviar el mismo evento -> ack duplicado sin re-persistir", async () => {
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set("x-device-key", apiKey)
      .send({ eventos: [{ eventoIdCliente: UUID_A, tipoEvento: "visita", payload: {} }] });

    expect(res.status).toBe(201);
    expect(res.body[0].estado).toBe("duplicado");
  });

  it("evento con tipo fuera del catálogo -> ack error", async () => {
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set("x-device-key", apiKey)
      .send({
        eventos: [
          { eventoIdCliente: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", tipoEvento: "no-existe", payload: {} },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body[0].estado).toBe("error");
  });

  it("evento trayectoria se ingiere y queda en el catálogo", async () => {
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set("x-device-key", apiKey)
      .send({
        eventos: [
          {
            eventoIdCliente: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            tipoEvento: "trayectoria",
            payload: {
              puntos: [
                { latitud: -17.78, longitud: -63.18 },
                { latitud: -17.79, longitud: -63.19 },
              ],
            },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body[0].estado).toMatch(/sincronizado|error/);
    const fila = await syncRepo.findOne({
      where: {
        dispositivo: { id: deviceId },
        eventoIdCliente: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      },
    });
    expect(fila).toBeDefined();
    expect(fila?.tipoEvento).toBe("trayectoria");
  });

  it("POST /sync-offline/eventos sin API key -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .send({ eventos: [] });
    expect(res.status).toBe(401);
  });

  it("GET /sync-offline/dia devuelve el snapshot del día (ruta + clientes + trayectos)", async () => {
    const res = await request(app.getHttpServer())
      .get("/sync-offline/dia")
      .set("x-device-key", apiKey);

    expect(res.status).toBe(200);
    expect(res.body.ruta.id).toBe(rutaId);
    expect(Array.isArray(res.body.clientes)).toBe(true);
    expect(res.body.trayectos).toBeNull();
  });

  it("GET /sync-offline/dia sin API key -> 401", async () => {
    const res = await request(app.getHttpServer()).get("/sync-offline/dia");
    expect(res.status).toBe(401);
  });
});