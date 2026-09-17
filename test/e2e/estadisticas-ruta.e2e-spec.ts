import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { RutaEstadisticasSnapshot } from "../../src/modules/rutas/ruta-estadisticas-snapshot.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

function fechaLocal(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

describe("Estadísticas de ruta (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let snapshotRepo: Repository<RutaEstadisticasSnapshot>;
  let accessTokenAdmin: string;
  let rutaId: number;

  const ADMIN_USERNAME = "estad-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Estad2026";
  const PASSWORD = "Socio#Estad2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-estad";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-estad";
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
    snapshotRepo = moduleFixture.get(getRepositoryToken(RutaEstadisticasSnapshot));

    await snapshotRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-ESTAD-1" });
    await socioRepo.delete({ codigo: "SC-ESTAD-1" });
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
      usuario: "socio-estad-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-estad-1@correo.com",
      telefono: "+59171160079",
      codigo: "SC-ESTAD-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-estad-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-estad-1@correo.com",
      telefono: "+59172270079",
      codigo: "CB-ESTAD-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta ESTAD",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;
  });

  afterAll(async () => {
    await snapshotRepo.createQueryBuilder().delete().execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-ESTAD-1" });
    await socioRepo.delete({ codigo: "SC-ESTAD-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  beforeEach(async () => {
    await snapshotRepo.delete({ ruta: { id: rutaId } });
  });

  it("GET /rutas/:id/estadisticas devuelve conteos y deltas contra ayer", async () => {
    await snapshotRepo.save(
      snapshotRepo.create({
        ruta: { id: rutaId } as Ruta,
        fecha: fechaLocal(-1),
        totalClientes: 3,
        clientesAtrasados: 1,
        clientesVencidos: 1,
        sinVisitaHoy: 1,
        sinVisitaDesdeUltimaLiquidada: 2,
        conPrestamosNuevos: 0,
        conMasDeUnPrestamo: 0,
        clientesNuevos: 0,
      }),
    );

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/estadisticas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.rutaId).toBe(rutaId);
    expect(res.body.actual.totalClientes).toBe(0);
    expect(res.body.anterior.totalClientes).toBe(3);
    expect(res.body.deltas.totalClientes).toBe(-3);
    expect(res.body.actual).toEqual(
      expect.objectContaining({
        clientesAtrasados: expect.any(Number),
        clientesVencidos: expect.any(Number),
        sinVisitaHoy: expect.any(Number),
        sinVisitaDesdeUltimaLiquidada: expect.any(Number),
        conPrestamosNuevos: expect.any(Number),
        conMasDeUnPrestamo: expect.any(Number),
        clientesNuevos: expect.any(Number),
      }),
    );
  });

  it("sin snapshots previos -> anterior null y deltas null", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/estadisticas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.anterior).toBeNull();
    expect(Object.values(res.body.deltas).every((d) => d === null)).toBe(true);
  });

  it("GET /rutas/:id/estadisticas con ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get("/rutas/999999/estadisticas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /rutas/:id/estadisticas sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/rutas/${rutaId}/estadisticas`);

    expect(res.status).toBe(401);
  });

  it("un socio SIN ver_reportes no puede ver las estadísticas -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-estad-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-estad-2@correo.com",
      telefono: "+59171160080",
      codigo: "SC-ESTAD-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-estad-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/estadisticas`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});
