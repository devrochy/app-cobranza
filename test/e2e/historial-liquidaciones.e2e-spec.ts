import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Liquidacion } from "../../src/modules/carteras/liquidacion.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Historial y exportación de liquidaciones (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let liquidacionRepo: Repository<Liquidacion>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let liquidacionId: number;

  const ADMIN_USERNAME = "hist-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Hist2026";
  const PASSWORD = "Propietario#Hist2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-hist";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-hist";
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
    liquidacionRepo = moduleFixture.get(getRepositoryToken(Liquidacion));

    await liquidacionRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-HIST-1" });
    await propietarioRepo.delete({ codigo: "SC-HIST-1" });
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
      usuario: "propietario-hist-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-hist-1@correo.com",
      telefono: "+59171160066",
      codigo: "SC-HIST-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-hist-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-hist-1@correo.com",
      telefono: "+59172270066",
      codigo: "CB-HIST-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera HIST",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    const liqRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ comentario: "primer cierre" });
    liquidacionId = liqRes.body.id as number;
  });

  afterAll(async () => {
    await liquidacionRepo.createQueryBuilder().delete().execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-HIST-1" });
    await propietarioRepo.delete({ codigo: "SC-HIST-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /carteras/:id/liquidaciones lista el historial", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("cajaActual");
    expect(res.body[0]).toHaveProperty("comisionValor");
  });

  it("GET /carteras/:id/liquidaciones/:liquidacionId/export descarga un xlsx", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/liquidaciones/${liquidacionId}/export`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.subarray(0, 2).toString()).toBe("PK");
  });

  it("GET /carteras/:id/liquidaciones sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraId}/liquidaciones`);

    expect(res.status).toBe(401);
  });

  it("GET /carteras/:id/liquidaciones/:id/export con liquidación inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/liquidaciones/999999/export`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("un propietario SIN ver_reportes ni descargar_reporte recibe 403 en historial y export", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-hist-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-hist-2@correo.com",
      telefono: "+59171160067",
      codigo: "SC-HIST-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-hist-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const historial = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/liquidaciones`)
      .set("Authorization", `Bearer ${tokenPropietario}`);
    expect(historial.status).toBe(403);

    const exportRes = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/liquidaciones/${liquidacionId}/export`)
      .set("Authorization", `Bearer ${tokenPropietario}`);
    expect(exportRes.status).toBe(403);

    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});