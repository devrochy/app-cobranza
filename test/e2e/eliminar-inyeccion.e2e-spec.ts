import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Caja } from "../../src/modules/carteras/caja.entity";
import { Inyeccion } from "../../src/modules/carteras/inyeccion.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Eliminación de inyecciones (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let inyRepo: Repository<Inyeccion>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let tokenPropietario: string;
  let carteraPropiaId: number;
  let carteraAjenaId: number;
  let inyeccionId: number;
  let inyeccion2Id: number;

  const ADMIN_USERNAME = "del-iny-e2e-admin";
  const ADMIN_PASSWORD = "del-iny-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "del-iny-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "del-iny-e2e-refresh-secret";
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
    inyRepo = moduleFixture.get(getRepositoryToken(Inyeccion));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));

    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await inyRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-DEL-INY-1" });
    await gestorRepo.delete({ codigo: "CB-DEL-INY-2" });
    await propietarioRepo.delete({ codigo: "SC-DEL-INY-1" });
    await propietarioRepo.delete({ codigo: "SC-DEL-INY-2" });
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
      usuario: "propietario-del-iny-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-del-iny-1@correo.com",
      telefono: "+59171150001",
      codigo: "SC-DEL-INY-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const propietario2 = await propietarioRepo.save({
      usuario: "propietario-del-iny-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-del-iny-2@correo.com",
      telefono: "+59171150002",
      codigo: "SC-DEL-INY-2",
      moneda: "BOB",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/propietarios/${propietario.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_cartera: true, eliminar_inyeccion: true } });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-del-iny-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-del-iny-1@correo.com",
      telefono: "+59172260001",
      codigo: "CB-DEL-INY-1",
      estatus: "activo",
    });
    const gestor2 = await gestorRepo.save({
      propietario: { id: propietario2.id },
      usuario: "gestor-del-iny-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-del-iny-2@correo.com",
      telefono: "+59172260002",
      codigo: "CB-DEL-INY-2",
      estatus: "activo",
    });

    const carteraPropia = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera DEL-INY-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraPropiaId = carteraPropia.id;
    await cajaRepo.save({
      cartera: { id: carteraPropiaId },
      carteraId: carteraPropiaId,
      saldoInicial: 1000,
      saldoActual: 1000,
    });

    const carteraAjena = await carteraRepo.save({
      propietario: { id: propietario2.id },
      gestor: { id: gestor2.id },
      nombre: "Cartera DEL-INY-2",
      descripcion: null,
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraAjenaId = carteraAjena.id;
    await cajaRepo.save({
      cartera: { id: carteraAjenaId },
      carteraId: carteraAjenaId,
      saldoInicial: 500,
      saldoActual: 500,
    });

    const iny = await request(app.getHttpServer())
      .post(`/carteras/${carteraPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 1500, comentario: "Aporte a eliminar" });
    inyeccionId = iny.body.id as number;

    const iny2 = await request(app.getHttpServer())
      .post(`/carteras/${carteraPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 300, comentario: "Otra inyección" });
    inyeccion2Id = iny2.body.id as number;

    tokenPropietario = await loginPropietario("propietario-del-iny-1");
  });

  afterAll(async () => {
    await inyRepo.delete({ id: inyeccionId });
    await inyRepo.delete({ id: inyeccion2Id });
    await carteraRepo.delete({ id: carteraPropiaId });
    await carteraRepo.delete({ id: carteraAjenaId });
    await gestorRepo.delete({ codigo: "CB-DEL-INY-1" });
    await gestorRepo.delete({ codigo: "CB-DEL-INY-2" });
    await propietarioRepo.delete({ codigo: "SC-DEL-INY-1" });
    await propietarioRepo.delete({ codigo: "SC-DEL-INY-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("DELETE /carteras/:id/inyecciones/:id -> 200 estado eliminada y el registro persiste con su fecha_hora", async () => {
    const antes = await inyRepo.findOne({ where: { id: inyeccionId } });

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraPropiaId}/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("eliminada");

    const persistido = await inyRepo.findOne({ where: { id: inyeccionId } });
    expect(persistido).toBeDefined();
    expect(persistido?.estado).toBe("eliminada");
    expect(persistido?.fechaHora).toEqual(antes?.fechaHora);
  });

  it("al eliminar la inyección revierte el saldo real de la caja (wiring)", async () => {
    // En beforeAll la caja quedó: 1000 + 1500 + 300 = 2800. Al eliminar la
    // inyección de 1500 (test anterior), el saldo debe bajar a 1300.
    const caja = await cajaRepo
      .createQueryBuilder("c")
      .where("c.cartera_id = :carteraId", { carteraId: carteraPropiaId })
      .getOne();
    expect(caja?.saldoActual).toBe(1300);
  });

  // Depende del test anterior: re-elimina la misma inyección ya eliminada.
  it("DELETE es idempotente (re-eliminar ya eliminada -> 200)", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraPropiaId}/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("eliminada");
  });

  it("un propietario sin eliminar_inyeccion no puede eliminar -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-del-iny-3",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-del-iny-3@correo.com",
      telefono: "+59171150003",
      codigo: "SC-DEL-INY-3",
      moneda: "BOB",
      estatus: "activo",
    });
    const token = await loginPropietario("propietario-del-iny-3");

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraPropiaId}/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });

  it("DELETE de una inyección que pertenece a otra cartera -> 404 (doble filtro)", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraAjenaId}/inyecciones/${inyeccion2Id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("un propietario con eliminar_inyeccion elimina en su propia cartera -> 200", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraPropiaId}/inyecciones/${inyeccion2Id}`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("eliminada");
  });

  it("un propietario no puede eliminar una inyección de una cartera ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraAjenaId}/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
  });

  it("DELETE de una inyección inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraPropiaId}/inyecciones/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("DELETE de una cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/carteras/999999/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("DELETE sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).delete(
      `/carteras/${carteraPropiaId}/inyecciones/${inyeccionId}`,
    );

    expect(res.status).toBe(401);
  });
});
