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
import { ReporteDiario } from "../../src/modules/rutas/reporte-diario.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Persistencia de trayectorias en reporte diario (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let logRepo: Repository<RutaOptimizadaLog>;
  let reporteRepo: Repository<ReporteDiario>;
  let accessTokenAdmin: string;
  let rutaId: number;

  const ADMIN_USERNAME = "tray-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Tray2E2026";
  const PASSWORD = "Socio#Tray2E2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-tray2e";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-tray2e";
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
    reporteRepo = moduleFixture.get(getRepositoryToken(ReporteDiario));

    await reporteRepo.createQueryBuilder().delete().execute();
    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-TRAY2E-1" });
    await socioRepo.delete({ codigo: "SC-TRAY2E-1" });
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
      usuario: "socio-tray2e-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-tray2e-1@correo.com",
      telefono: "+59171160140",
      codigo: "SC-TRAY2E-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-tray2e-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-tray2e-1@correo.com",
      telefono: "+59172270140",
      codigo: "CB-TRAY2E-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta TRAY2E",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
      });
    rutaId = rutaRes.body.id as number;

    // Cliente con deuda para el trayecto planificado.
    const c1 = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Tray",
        apellido: "Cliente",
        negocio: "N1",
        telefonoWhatsapp: "+59171160141",
        latitud: -17.78,
        longitud: -63.18,
      });
    const c1Id = c1.body.id as number;
    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: c1Id, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });

    // Generar el trayecto planificado (item 17).
    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/dia/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);
  });

  afterAll(async () => {
    await reporteRepo.createQueryBuilder().delete().execute();
    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id = :rutaId)", { rutaId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-TRAY2E-1" });
    await socioRepo.delete({ codigo: "SC-TRAY2E-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas/:id/dia/trayectoria-real registra la trayectoria real y crea el reporte", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/dia/trayectoria-real`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ puntos: [{ latitud: -17.78, longitud: -63.18 }, { latitud: -17.79, longitud: -63.19 }] });

    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe("real");

    const real = await logRepo.findOne({ where: { ruta: { id: rutaId }, tipo: "real" } });
    expect(real).toBeDefined();
    const reporte = await reporteRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(reporte).toBeDefined();
  });

  it("GET /rutas/:id/dia/trayectorias devuelve el reporte del día con planificada y real", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/dia/trayectorias`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.fecha).toBeDefined();
    expect(res.body.trayectoriasJson).toBeDefined();
    expect(res.body.trayectoriasJson.type).toBe("FeatureCollection");
    const origenes = res.body.trayectoriasJson.features.map(
      (f: { properties: { origen: string } }) => f.properties.origen,
    );
    expect(origenes).toContain("planificada");
    expect(origenes).toContain("real");
  });

  it("GET /rutas/:id/dia/trayectorias con ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/999999/dia/trayectorias`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("POST /rutas/:id/dia/trayectoria-real con menos de 2 puntos -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/dia/trayectoria-real`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ puntos: [{ latitud: -17.78, longitud: -63.18 }] });

    expect(res.status).toBe(400);
  });

  it("un socio SIN ver_reportes no puede registrar la trayectoria real -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-tray2e-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-tray2e-2@correo.com",
      telefono: "+59171160142",
      codigo: "SC-TRAY2E-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-tray2e-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/dia/trayectoria-real`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ puntos: [{ latitud: -17.78, longitud: -63.18 }] });

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});