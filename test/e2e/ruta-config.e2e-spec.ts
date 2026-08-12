import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { RutaConfig } from "../../src/modules/rutas/ruta-config.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Matriz ruta_config (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let rutaConfigRepo: Repository<RutaConfig>;
  let accessTokenAdmin: string;
  let tokenSocio: string;
  let rutaPropiaId: number;
  let rutaAjenaId: number;

  const ADMIN_USERNAME = "rcfg-e2e-admin";
  const ADMIN_PASSWORD = "rcfg-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "rcfg-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "rcfg-e2e-refresh-secret";
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
    rutaConfigRepo = moduleFixture.get(getRepositoryToken(RutaConfig));

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
      usuario: "socio-rcfg-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-rcfg-1@correo.com",
      telefono: "+59171130001",
      codigo: "SC-RCFG-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const socio2 = await socioRepo.save({
      usuario: "socio-rcfg-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-rcfg-2@correo.com",
      telefono: "+59171130002",
      codigo: "SC-RCFG-2",
      moneda: "BOB",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/socios/${socio.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_ruta: true } });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-rcfg-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-rcfg-1@correo.com",
      telefono: "+59172240001",
      codigo: "CB-RCFG-1",
      estatus: "activo",
    });
    const cobrador2 = await cobradorRepo.save({
      socio: { id: socio2.id },
      usuario: "cobrador-rcfg-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-rcfg-2@correo.com",
      telefono: "+59172240002",
      codigo: "CB-RCFG-2",
      estatus: "activo",
    });

    const rutaPropia = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta RCFG-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaPropiaId = rutaPropia.id;

    const rutaAjena = await rutaRepo.save({
      socio: { id: socio2.id },
      cobrador: { id: cobrador2.id },
      nombre: "Ruta RCFG-2",
      descripcion: null,
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaAjenaId = rutaAjena.id;

    tokenSocio = await loginSocio("socio-rcfg-1");
  });

  afterAll(async () => {
    await rutaConfigRepo.delete({ ruta: { id: rutaPropiaId } });
    await rutaConfigRepo.delete({ ruta: { id: rutaAjenaId } });
    await rutaRepo.delete({ id: rutaPropiaId });
    await rutaRepo.delete({ id: rutaAjenaId });
    await cobradorRepo.delete({ codigo: "CB-RCFG-1" });
    await cobradorRepo.delete({ codigo: "CB-RCFG-2" });
    await socioRepo.delete({ codigo: "SC-RCFG-1" });
    await socioRepo.delete({ codigo: "SC-RCFG-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /rutas/:id/ruta-config devuelve defaults conservadores", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaPropiaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.mostrarCaja).toBe(false);
    expect(res.body.eliminarPrestamosApk).toBe(false);
    expect(res.body.cupoDefault).toBe(0);
    expect(res.body.rutaId).toBe(rutaPropiaId);
  });

  it("PUT /rutas/:id/ruta-config configura y GET lo refleja", async () => {
    const put = await request(app.getHttpServer())
      .put(`/rutas/${rutaPropiaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ mostrarCaja: true, cupoDefault: 2000, comisionPorcentaje: 10 });

    expect(put.status).toBe(200);
    expect(put.body.mostrarCaja).toBe(true);
    expect(put.body.cupoDefault).toBe(2000);
    expect(put.body.eliminarPrestamosApk).toBe(false);

    const get = await request(app.getHttpServer())
      .get(`/rutas/${rutaPropiaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(get.body.mostrarCaja).toBe(true);
    expect(get.body.cupoDefault).toBe(2000);
  });

  it("PUT /rutas/:id/ruta-config reemplaza (ausentes vuelven a default)", async () => {
    const put = await request(app.getHttpServer())
      .put(`/rutas/${rutaPropiaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ mostrarPrestamos: true });

    expect(put.status).toBe(200);
    expect(put.body.mostrarPrestamos).toBe(true);
    expect(put.body.mostrarCaja).toBe(false);
    expect(put.body.cupoDefault).toBe(0);
  });

  it("PUT /rutas/:id/ruta-config con body vacío resetea a defaults", async () => {
    const put = await request(app.getHttpServer())
      .put(`/rutas/${rutaPropiaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(put.status).toBe(200);
    expect(put.body.mostrarPrestamos).toBe(false);
    expect(put.body.mostrarCaja).toBe(false);
    expect(put.body.cupoDefault).toBe(0);
  });

  it("PUT /rutas/:id/ruta-config de una ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .put(`/rutas/999999/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ mostrarCaja: true });

    expect(res.status).toBe(404);
  });

  it("un socio con configurar_ruta configura su ruta -> 200", async () => {
    const res = await request(app.getHttpServer())
      .put(`/rutas/${rutaPropiaId}/ruta-config`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ reconocimientoFacialActivo: true });

    expect(res.status).toBe(200);
    expect(res.body.reconocimientoFacialActivo).toBe(true);
  });

  it("un socio no puede configurar una ruta ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .put(`/rutas/${rutaAjenaId}/ruta-config`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ mostrarCaja: true });

    expect(res.status).toBe(403);
  });

  it("PUT /rutas/:id/ruta-config con valores fuera de rango -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put(`/rutas/${rutaPropiaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cupoDefault: 0, comisionPorcentaje: 150 });

    expect(res.status).toBe(400);
  });

  it("GET /rutas/:id/ruta-config de una ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/999999/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /rutas/:id/ruta-config sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/rutas/${rutaPropiaId}/ruta-config`);

    expect(res.status).toBe(401);
  });
});
