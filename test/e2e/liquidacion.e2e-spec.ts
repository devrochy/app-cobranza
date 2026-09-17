import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Liquidacion } from "../../src/modules/carteras/liquidacion.entity";
import { CarteraConfig } from "../../src/modules/carteras/cartera-config.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Generación de liquidación de cartera (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let configRepo: Repository<CarteraConfig>;
  let liquidacionRepo: Repository<Liquidacion>;
  let accessTokenAdmin: string;
  let carteraId: number;

  const ADMIN_USERNAME = "liq-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Liq2026";
  const PASSWORD = "Propietario#Liq2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-liq";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-liq";
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
    configRepo = moduleFixture.get(getRepositoryToken(CarteraConfig));
    liquidacionRepo = moduleFixture.get(getRepositoryToken(Liquidacion));

    await liquidacionRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-LIQ-1" });
    await propietarioRepo.delete({ codigo: "SC-LIQ-1" });
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
      usuario: "propietario-liq-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-liq-1@correo.com",
      telefono: "+59171160055",
      codigo: "SC-LIQ-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-liq-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-liq-1@correo.com",
      telefono: "+59172270055",
      codigo: "CB-LIQ-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera LIQ",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    // Config: comisión 10% activa, periodo diario.
    await request(app.getHttpServer())
      .put(`/carteras/${carteraId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ comisionActiva: true, comisionPorcentaje: 10, periodoLiquidacion: "diario" });
  });

  afterAll(async () => {
    await liquidacionRepo.createQueryBuilder().delete().execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-LIQ-1" });
    await propietarioRepo.delete({ codigo: "SC-LIQ-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("config acepta periodoLiquidacion", async () => {
    const fila = await configRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(fila?.periodoLiquidacion).toBe("diario");
  });

  it("POST /carteras/:id/liquidaciones genera el snapshot con caja y comisión", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ comentario: "cierre de jornada" });

    expect(res.status).toBe(201);
    expect(res.body.carteraId).toBe(carteraId);
    expect(res.body.cajaAnterior).toBe(1000); // saldo inicial (sin previa)
    expect(res.body.periodo).toBe("diario");
    expect(res.body.comisionPorcentaje).toBe(10);
    expect(res.body.comisionValor).toBeGreaterThanOrEqual(0);
    expect(res.body.comentario).toBe("cierre de jornada");

    const enDb = await liquidacionRepo.findOne({ where: { id: res.body.id } });
    expect(enDb).toBeDefined();
    expect(enDb?.comentario).toBe("cierre de jornada");
  });

  it("POST /carteras/:id/liquidaciones en el mismo periodo -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(res.status).toBe(409);
  });

  it("POST /carteras/:id/liquidaciones sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/liquidaciones`)
      .send({});

    expect(res.status).toBe(401);
  });

  it("un propietario SIN generar_reporte no puede liquidar -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-liq-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-liq-2@correo.com",
      telefono: "+59171160056",
      codigo: "SC-LIQ-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-liq-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/liquidaciones`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({});

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });

  it("POST /carteras/:id/liquidaciones con cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/999999/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(res.status).toBe(404);
  });
});