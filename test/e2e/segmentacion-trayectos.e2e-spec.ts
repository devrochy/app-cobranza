import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { RutaOptimizadaLog } from "../../src/modules/rutas/ruta-optimizada-log.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Segmentación de trayectos de la ruta del día (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let logRepo: Repository<RutaOptimizadaLog>;
  let accessTokenAdmin: string;
  let rutaId: number;

  const ADMIN_USERNAME = "tray-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Tray2026";
  const PASSWORD = "Socio#Tray2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-tray";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-tray";
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
    logRepo = moduleFixture.get(getRepositoryToken(RutaOptimizadaLog));

    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-TRAY-1" });
    await socioRepo.delete({ codigo: "SC-TRAY-1" });
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
      usuario: "socio-tray-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-tray-1@correo.com",
      telefono: "+59171160088",
      codigo: "SC-TRAY-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-tray-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-tray-1@correo.com",
      telefono: "+59172270088",
      codigo: "CB-TRAY-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta TRAY",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;

    // 3 clientes cercanos con préstamo (deuda pendiente).
    for (let i = 1; i <= 3; i++) {
      const clienteRes = await request(app.getHttpServer())
        .post(`/rutas/${rutaId}/clientes`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({
          nombre: `Cliente${i}`,
          apellido: "Tray",
          negocio: `Negocio${i}`,
          telefonoWhatsapp: `+5917116009${i}`,
          latitud: -17.78 + i * 0.002,
          longitud: -63.18 + i * 0.002,
        });
      const clienteId = clienteRes.body.id as number;
      await request(app.getHttpServer())
        .post(`/rutas/${rutaId}/prestamos`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ clienteId, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
    }

    // 1 cliente sin deuda (sin préstamo): NO debe aparecer en los trayectos del día.
    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "SinDeuda",
        apellido: "Tray",
        negocio: "SinDeuda",
        telefonoWhatsapp: "+59171160094",
        latitud: -17.78,
        longitud: -63.18,
      });
  });

  afterAll(async () => {
    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id = :rutaId)", { rutaId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-TRAY-1" });
    await socioRepo.delete({ codigo: "SC-TRAY-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas/:id/dia/trayectos segmenta y persiste los trayectos", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/dia/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const ids = res.body.flat().map((p: { clienteId: number }) => p.clienteId);
    // Solo los 3 clientes con deuda; el cliente sin préstamo NO se incluye.
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain(undefined);

    const enDb = await logRepo.findOne({ where: { ruta: { id: rutaId }, tipo: "planificada" } });
    expect(enDb).toBeDefined();
    expect(enDb?.recalculado).toBe(false);
  });

  it("GET /rutas/:id/dia/trayectos consulta el trayecto planificado del día", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/dia/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.tipo).toBe("planificada");
    expect(res.body.distanciaEstimadaKm).toBeGreaterThanOrEqual(0);
  });

  it("GET /rutas/:id/dia/trayectos con ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/999999/dia/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("POST /rutas/:id/dia/trayectos sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).post(`/rutas/${rutaId}/dia/trayectos`);

    expect(res.status).toBe(401);
  });

  it("un socio SIN generar_reporte no puede generar trayectos -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-tray-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-tray-2@correo.com",
      telefono: "+59171160090",
      codigo: "SC-TRAY-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-tray-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/dia/trayectos`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});