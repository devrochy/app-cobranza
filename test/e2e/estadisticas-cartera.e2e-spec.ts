import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { CarteraEstadisticasSnapshot } from "../../src/modules/carteras/cartera-estadisticas-snapshot.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

function fechaLocal(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

describe("Estadísticas de cartera (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let snapshotRepo: Repository<CarteraEstadisticasSnapshot>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let gestorId: number;

  const ADMIN_USERNAME = "estad-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Estad2026";
  const PASSWORD = "Propietario#Estad2026";

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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    snapshotRepo = moduleFixture.get(getRepositoryToken(CarteraEstadisticasSnapshot));

    await snapshotRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-ESTAD-1" });
    await propietarioRepo.delete({ codigo: "SC-ESTAD-1" });
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
      usuario: "propietario-estad-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-estad-1@correo.com",
      telefono: "+59171160079",
      codigo: "SC-ESTAD-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-estad-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-estad-1@correo.com",
      telefono: "+59172270079",
      codigo: "CB-ESTAD-1",
      estatus: "activo",
    });
    gestorId = gestor.id;

    await request(app.getHttpServer())
      .put(`/gestores/${gestorId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { ver_cartera: true } });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera ESTAD",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;
  });

  afterAll(async () => {
    await snapshotRepo.createQueryBuilder().delete().execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-ESTAD-1" });
    await propietarioRepo.delete({ codigo: "SC-ESTAD-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  beforeEach(async () => {
    await snapshotRepo.delete({ cartera: { id: carteraId } });
  });

  it("GET /carteras/:id/estadisticas devuelve conteos y deltas contra ayer", async () => {
    await snapshotRepo.save(
      snapshotRepo.create({
        cartera: { id: carteraId } as Cartera,
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
      .get(`/carteras/${carteraId}/estadisticas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.carteraId).toBe(carteraId);
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
      .get(`/carteras/${carteraId}/estadisticas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.anterior).toBeNull();
    expect(Object.values(res.body.deltas).every((d) => d === null)).toBe(true);
  });

  it("GET /carteras/:id/estadisticas con cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get("/carteras/999999/estadisticas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /carteras/:id/estadisticas sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraId}/estadisticas`);

    expect(res.status).toBe(401);
  });

  it("un propietario SIN ver_reportes no puede ver las estadísticas -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-estad-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-estad-2@correo.com",
      telefono: "+59171160080",
      codigo: "SC-ESTAD-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-estad-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/estadisticas`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });

  it("GET /gestor/carteras/:carteraId/estadisticas devuelve las estadísticas al gestor de la cartera", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario: "gestor-estad-1", password: PASSWORD });
    const tokenGestor = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${carteraId}/estadisticas`)
      .set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.carteraId).toBe(carteraId);
    expect(res.body.actual.totalClientes).toBe(0);
    expect(res.body.deltas.totalClientes).toBeNull();
  });

  it("GET /gestor/carteras/:carteraId/estadisticas sin ver_cartera -> 403", async () => {
    const gestorSinPermiso = await gestorRepo.save({
      propietario: { id: (await propietarioRepo.findOneOrFail({ where: { codigo: "SC-ESTAD-1" } })).id },
      usuario: "gestor-estad-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C2",
      apellido: "E2E",
      correo: "gestor-estad-2@correo.com",
      telefono: "+59172270081",
      codigo: "CB-ESTAD-2",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario: "gestor-estad-2", password: PASSWORD });
    const tokenGestor = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/gestor/carteras/${carteraId}/estadisticas`)
      .set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(403);
    await gestorRepo.delete({ id: gestorSinPermiso.id });
  });
});
