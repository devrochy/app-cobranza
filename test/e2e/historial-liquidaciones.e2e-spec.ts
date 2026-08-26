import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Liquidacion } from "../../src/modules/rutas/liquidacion.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Historial y exportación de liquidaciones (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let liquidacionRepo: Repository<Liquidacion>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let liquidacionId: number;

  const ADMIN_USERNAME = "hist-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Hist2026";
  const PASSWORD = "Socio#Hist2026";

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    liquidacionRepo = moduleFixture.get(getRepositoryToken(Liquidacion));

    await liquidacionRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-HIST-1" });
    await socioRepo.delete({ codigo: "SC-HIST-1" });
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
      usuario: "socio-hist-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-hist-1@correo.com",
      telefono: "+59171160066",
      codigo: "SC-HIST-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-hist-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-hist-1@correo.com",
      telefono: "+59172270066",
      codigo: "CB-HIST-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta HIST",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;

    const liqRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ comentario: "primer cierre" });
    liquidacionId = liqRes.body.id as number;
  });

  afterAll(async () => {
    await liquidacionRepo.createQueryBuilder().delete().execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-HIST-1" });
    await socioRepo.delete({ codigo: "SC-HIST-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /rutas/:id/liquidaciones lista el historial", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/liquidaciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("cajaActual");
    expect(res.body[0]).toHaveProperty("comisionValor");
  });

  it("GET /rutas/:id/liquidaciones/:liquidacionId/export descarga un xlsx", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/liquidaciones/${liquidacionId}/export`)
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

  it("GET /rutas/:id/liquidaciones sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/rutas/${rutaId}/liquidaciones`);

    expect(res.status).toBe(401);
  });

  it("GET /rutas/:id/liquidaciones/:id/export con liquidación inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/liquidaciones/999999/export`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("un socio SIN ver_reportes ni descargar_reporte recibe 403 en historial y export", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-hist-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-hist-2@correo.com",
      telefono: "+59171160067",
      codigo: "SC-HIST-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-hist-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const historial = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/liquidaciones`)
      .set("Authorization", `Bearer ${tokenSocio}`);
    expect(historial.status).toBe(403);

    const exportRes = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/liquidaciones/${liquidacionId}/export`)
      .set("Authorization", `Bearer ${tokenSocio}`);
    expect(exportRes.status).toBe(403);

    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});