import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { CarteraConfig } from "../../src/modules/carteras/cartera-config.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Matriz cartera_config (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let carteraConfigRepo: Repository<CarteraConfig>;
  let accessTokenAdmin: string;
  let tokenPropietario: string;
  let carteraPropiaId: number;
  let carteraAjenaId: number;

  const ADMIN_USERNAME = "rcfg-e2e-admin";
  const ADMIN_PASSWORD = "rcfg-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    carteraConfigRepo = moduleFixture.get(getRepositoryToken(CarteraConfig));

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
      usuario: "propietario-rcfg-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-rcfg-1@correo.com",
      telefono: "+59171130001",
      codigo: "SC-RCFG-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const propietario2 = await propietarioRepo.save({
      usuario: "propietario-rcfg-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-rcfg-2@correo.com",
      telefono: "+59171130002",
      codigo: "SC-RCFG-2",
      moneda: "BOB",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/propietarios/${propietario.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_cartera: true } });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-rcfg-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-rcfg-1@correo.com",
      telefono: "+59172240001",
      codigo: "CB-RCFG-1",
      estatus: "activo",
    });
    const gestor2 = await gestorRepo.save({
      propietario: { id: propietario2.id },
      usuario: "gestor-rcfg-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-rcfg-2@correo.com",
      telefono: "+59172240002",
      codigo: "CB-RCFG-2",
      estatus: "activo",
    });

    const carteraPropia = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera RCFG-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraPropiaId = carteraPropia.id;

    const carteraAjena = await carteraRepo.save({
      propietario: { id: propietario2.id },
      gestor: { id: gestor2.id },
      nombre: "Cartera RCFG-2",
      descripcion: null,
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraAjenaId = carteraAjena.id;

    tokenPropietario = await loginPropietario("propietario-rcfg-1");
  });

  afterAll(async () => {
    await carteraConfigRepo.delete({ cartera: { id: carteraPropiaId } });
    await carteraConfigRepo.delete({ cartera: { id: carteraAjenaId } });
    await carteraRepo.delete({ id: carteraPropiaId });
    await carteraRepo.delete({ id: carteraAjenaId });
    await gestorRepo.delete({ codigo: "CB-RCFG-1" });
    await gestorRepo.delete({ codigo: "CB-RCFG-2" });
    await propietarioRepo.delete({ codigo: "SC-RCFG-1" });
    await propietarioRepo.delete({ codigo: "SC-RCFG-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /carteras/:id/cartera-config devuelve defaults conservadores", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraPropiaId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.mostrarCaja).toBe(false);
    expect(res.body.eliminarPrestamosApk).toBe(false);
    expect(res.body.cupoDefault).toBe(0);
    expect(res.body.diasNoLaborables).toBe("solo_domingos");
    expect(res.body.carteraId).toBe(carteraPropiaId);
  });

  it("PUT /carteras/:id/cartera-config configura y GET lo refleja", async () => {
    const put = await request(app.getHttpServer())
      .put(`/carteras/${carteraPropiaId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ mostrarCaja: true, cupoDefault: 2000, comisionPorcentaje: 10, diasNoLaborables: "domingos_y_feriados" });

    expect(put.status).toBe(200);
    expect(put.body.mostrarCaja).toBe(true);
    expect(put.body.cupoDefault).toBe(2000);
    expect(put.body.diasNoLaborables).toBe("domingos_y_feriados");
    expect(put.body.eliminarPrestamosApk).toBe(false);

    const get = await request(app.getHttpServer())
      .get(`/carteras/${carteraPropiaId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(get.body.mostrarCaja).toBe(true);
    expect(get.body.cupoDefault).toBe(2000);
  });

  it("PUT /carteras/:id/cartera-config reemplaza (ausentes vuelven a default)", async () => {
    const put = await request(app.getHttpServer())
      .put(`/carteras/${carteraPropiaId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ mostrarPrestamos: true });

    expect(put.status).toBe(200);
    expect(put.body.mostrarPrestamos).toBe(true);
    expect(put.body.mostrarCaja).toBe(false);
    expect(put.body.cupoDefault).toBe(0);
  });

  it("PUT /carteras/:id/cartera-config con body vacío resetea a defaults", async () => {
    const put = await request(app.getHttpServer())
      .put(`/carteras/${carteraPropiaId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(put.status).toBe(200);
    expect(put.body.mostrarPrestamos).toBe(false);
    expect(put.body.mostrarCaja).toBe(false);
    expect(put.body.cupoDefault).toBe(0);
  });

  it("PUT /carteras/:id/cartera-config de una cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .put(`/carteras/999999/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ mostrarCaja: true });

    expect(res.status).toBe(404);
  });

  it("un propietario con configurar_cartera configura su cartera -> 200", async () => {
    const res = await request(app.getHttpServer())
      .put(`/carteras/${carteraPropiaId}/cartera-config`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ reconocimientoFacialActivo: true });

    expect(res.status).toBe(200);
    expect(res.body.reconocimientoFacialActivo).toBe(true);
  });

  it("un propietario no puede configurar una cartera ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .put(`/carteras/${carteraAjenaId}/cartera-config`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ mostrarCaja: true });

    expect(res.status).toBe(403);
  });

  it("PUT /carteras/:id/cartera-config con valores fuera de rango -> 400", async () => {
    const res = await request(app.getHttpServer())
      .put(`/carteras/${carteraPropiaId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cupoDefault: 0, comisionPorcentaje: 150 });

    expect(res.status).toBe(400);
  });

  it("GET /carteras/:id/cartera-config de una cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/999999/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /carteras/:id/cartera-config sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraPropiaId}/cartera-config`);

    expect(res.status).toBe(401);
  });
});
