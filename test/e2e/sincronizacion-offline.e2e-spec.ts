import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { generateKeyPairSync } from "crypto";
import request from "supertest";
import { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Device } from "../../src/modules/sincronizacion-offline/device.entity";
import { SincronizacionOffline } from "../../src/modules/sincronizacion-offline/sincronizacion-offline.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gasto } from "../../src/modules/carteras/gasto.entity";
import { GastoEvidencia } from "../../src/modules/carteras/gasto-evidencia.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";

describe("Sincronización offline (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let deviceRepo: Repository<Device>;
  let syncRepo: Repository<SincronizacionOffline>;
  let gastoRepo: Repository<Gasto>;
  let evidenciaRepo: Repository<GastoEvidencia>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let apiKey: string;
  let deviceId: number;
  let gestorId: number;

  const ADMIN_USERNAME = "sync-e2e-admin";
  const ADMIN_PASSWORD = "sync-e2e-password";
  const PASSWORD = "password-seguro";
  const UUID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const UUID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  const deviceKeyPair = generateKeyPairSync("x25519");
  const publicKeyBase64 = Buffer.from(
    deviceKeyPair.publicKey.export({ format: "jwk" }).x as string,
    "base64url",
  ).toString("base64");

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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    deviceRepo = moduleFixture.get(getRepositoryToken(Device));
    syncRepo = moduleFixture.get(getRepositoryToken(SincronizacionOffline));
    gastoRepo = moduleFixture.get(getRepositoryToken(Gasto));
    evidenciaRepo = moduleFixture.get(getRepositoryToken(GastoEvidencia));

    // Orden seguro por FK: primero gestores, luego propietarios (si un run previo
    // dejó el gestor, borrarlo antes evita violar la FK de propietario).
    await gestorRepo.delete({ codigo: "CB-SYNC-1" });
    await propietarioRepo.delete({ codigo: "SC-SYNC-1" });
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

    const propietario = await propietarioRepo.save({
      usuario: "propietario-sync-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Sync",
      correo: "propietario-sync-1@correo.com",
      telefono: "+59171160060",
      codigo: "SC-SYNC-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-sync-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "Sync",
      correo: "gestor-sync-1@correo.com",
      telefono: "+59172260060",
      codigo: "CB-SYNC-1",
      estatus: "activo",
    });
    gestorId = gestor.id;
    const cartera = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera SYNC-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      costoCobro: 250,
      estatus: "activo",
    });
    carteraId = cartera.id;

    await deviceRepo.delete({ gestorId });
  });

  afterAll(async () => {
    if (deviceId) {
      await syncRepo.delete({ dispositivo: { id: deviceId } });
    }
    // El on-ingest aplica el evento `gasto` de prueba → limpiar gastos/evidencias
    // antes de borrar la cartera (FK).
    await evidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await deviceRepo.delete({ gestorId });
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-SYNC-1" });
    await propietarioRepo.delete({ codigo: "SC-SYNC-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /devices (admin) registra un dispositivo y devuelve la API key", async () => {
    const res = await request(app.getHttpServer())
      .post("/devices")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        gestorId,
        imei: "imei-e2e",
        whatsappNumber: "+59172260060",
        publicKey: publicKeyBase64,
      });

    expect(res.status).toBe(201);
    expect(res.body.codigo).toBeDefined();
    expect(res.body.apiKey).toContain(".");
    expect(res.body.gestorId).toBe(gestorId);
    apiKey = res.body.apiKey as string;
    deviceId = res.body.codigo ? (await deviceRepo.findOne({ where: { codigo: res.body.codigo } }))!.id : 0;
  });

  it("POST /devices sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/devices")
      .send({ gestorId, imei: "x", whatsappNumber: "y", publicKey: "z" });
    expect(res.status).toBe(401);
  });

  it("POST /sync-offline/eventos ingiere eventos (ack) y los deja listos para aplicar", async () => {
    const res = await request(app.getHttpServer())
      .post("/sync-offline/eventos")
      .set("x-device-key", apiKey)
      .send({
        eventos: [
          { eventoIdCliente: UUID_A, tipoEvento: "visita", payload: { carteraId, resultado: "pago", monto: 250 } },
          { eventoIdCliente: UUID_B, tipoEvento: "gasto", payload: { carteraId, descripcion: "gasolina", valor: 50 } },
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
              carteraId,
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

  it("GET /sync-offline/trayecto-diario devuelve el snapshot del día cifrado (HU-40)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/sync-offline/trayecto-diario?carteraId=${carteraId}`)
      .set("x-device-key", apiKey);

    expect(res.status).toBe(200);
    expect(res.body.cifrado).toBe(true);
    expect(res.body.algoritmo).toBe("x25519-hkdf-sha256-aes256gcm");
    expect(res.body.clavePublicaEfimera).toBeDefined();
    expect(res.body.nonce).toBeDefined();
    expect(res.body.datos).toBeDefined();
  });

  it("GET /sync-offline/trayecto-diario sin API key -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/sync-offline/trayecto-diario?carteraId=${carteraId}`);
    expect(res.status).toBe(401);
  });
});