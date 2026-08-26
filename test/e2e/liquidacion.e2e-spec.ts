import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Liquidacion } from "../../src/modules/rutas/liquidacion.entity";
import { RutaConfig } from "../../src/modules/rutas/ruta-config.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Generación de liquidación de ruta (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let configRepo: Repository<RutaConfig>;
  let liquidacionRepo: Repository<Liquidacion>;
  let accessTokenAdmin: string;
  let rutaId: number;

  const ADMIN_USERNAME = "liq-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Liq2026";
  const PASSWORD = "Socio#Liq2026";

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    configRepo = moduleFixture.get(getRepositoryToken(RutaConfig));
    liquidacionRepo = moduleFixture.get(getRepositoryToken(Liquidacion));

    await liquidacionRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-LIQ-1" });
    await socioRepo.delete({ codigo: "SC-LIQ-1" });
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
      usuario: "socio-liq-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-liq-1@correo.com",
      telefono: "+59171160055",
      codigo: "SC-LIQ-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-liq-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-liq-1@correo.com",
      telefono: "+59172270055",
      codigo: "CB-LIQ-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta LIQ",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;

    // Config: comisión 10% activa, periodo diario.
    await request(app.getHttpServer())
      .put(`/rutas/${rutaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ comisionActiva: true, comisionPorcentaje: 10, periodoLiquidacion: "diario" });
  });

  afterAll(async () => {
    await liquidacionRepo.createQueryBuilder().delete().execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-LIQ-1" });
    await socioRepo.delete({ codigo: "SC-LIQ-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("config acepta periodoLiquidacion", async () => {
    const fila = await configRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(fila?.periodoLiquidacion).toBe("diario");
  });

  it("POST /rutas/:id/liquidaciones genera el snapshot con caja y comisión", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ comentario: "cierre de jornada" });

    expect(res.status).toBe(201);
    expect(res.body.rutaId).toBe(rutaId);
    expect(res.body.cajaAnterior).toBe(1000); // saldo inicial (sin previa)
    expect(res.body.periodo).toBe("diario");
    expect(res.body.comisionPorcentaje).toBe(10);
    expect(res.body.comisionValor).toBeGreaterThanOrEqual(0);
    expect(res.body.comentario).toBe("cierre de jornada");

    const enDb = await liquidacionRepo.findOne({ where: { id: res.body.id } });
    expect(enDb).toBeDefined();
    expect(enDb?.comentario).toBe("cierre de jornada");
  });

  it("POST /rutas/:id/liquidaciones en el mismo periodo -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(res.status).toBe(409);
  });

  it("POST /rutas/:id/liquidaciones sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/liquidaciones`)
      .send({});

    expect(res.status).toBe(401);
  });

  it("un socio SIN generar_reporte no puede liquidar -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-liq-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-liq-2@correo.com",
      telefono: "+59171160056",
      codigo: "SC-LIQ-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-liq-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/liquidaciones`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({});

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });

  it("POST /rutas/:id/liquidaciones con ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/999999/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(res.status).toBe(404);
  });
});