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

describe("Registro de inyecciones de capital (e2e)", () => {
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

  const ADMIN_USERNAME = "iny-e2e-admin";
  const ADMIN_PASSWORD = "iny-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "iny-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "iny-e2e-refresh-secret";
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
    await gestorRepo.delete({ codigo: "CB-INY-1" });
    await gestorRepo.delete({ codigo: "CB-INY-2" });
    await propietarioRepo.delete({ codigo: "SC-INY-1" });
    await propietarioRepo.delete({ codigo: "SC-INY-2" });
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
      usuario: "propietario-iny-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-iny-1@correo.com",
      telefono: "+59171140001",
      codigo: "SC-INY-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const propietario2 = await propietarioRepo.save({
      usuario: "propietario-iny-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-iny-2@correo.com",
      telefono: "+59171140002",
      codigo: "SC-INY-2",
      moneda: "BOB",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/propietarios/${propietario.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_cartera: true } });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-iny-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-iny-1@correo.com",
      telefono: "+59172250001",
      codigo: "CB-INY-1",
      estatus: "activo",
    });
    const gestor2 = await gestorRepo.save({
      propietario: { id: propietario2.id },
      usuario: "gestor-iny-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-iny-2@correo.com",
      telefono: "+59172250002",
      codigo: "CB-INY-2",
      estatus: "activo",
    });

    const carteraPropia = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera INY-1",
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
      nombre: "Cartera INY-2",
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

    tokenPropietario = await loginPropietario("propietario-iny-1");
  });

  afterAll(async () => {
    await inyRepo.delete({ cartera: { id: carteraPropiaId } });
    await inyRepo.delete({ cartera: { id: carteraAjenaId } });
    await carteraRepo.delete({ id: carteraPropiaId });
    await carteraRepo.delete({ id: carteraAjenaId });
    await gestorRepo.delete({ codigo: "CB-INY-1" });
    await gestorRepo.delete({ codigo: "CB-INY-2" });
    await propietarioRepo.delete({ codigo: "SC-INY-1" });
    await propietarioRepo.delete({ codigo: "SC-INY-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /carteras/:id/inyecciones como admin -> 201 con estado activa y fechaHora", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 1500, comentario: "Aporte semanal" });

    expect(res.status).toBe(201);
    expect(res.body.valor).toBe(1500);
    expect(res.body.comentario).toBe("Aporte semanal");
    expect(res.body.estado).toBe("activa");
    expect(() => new Date(res.body.fechaHora).toISOString()).not.toThrow();
    expect(res.body.carteraId).toBe(carteraPropiaId);
  });

  it("la inyección aumenta el saldo real de la caja de la cartera (wiring)", async () => {
    await request(app.getHttpServer())
      .post(`/carteras/${carteraPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 300, comentario: "Aporte wiring" });

    const caja = await cajaRepo
      .createQueryBuilder("c")
      .where("c.cartera_id = :carteraId", { carteraId: carteraPropiaId })
      .getOne();
    // saldo inicial 1000 + 1500 (test anterior) + 300 = 2800
    expect(caja?.saldoActual).toBe(2800);
  });

  it("un propietario con configurar_cartera registra en su propia cartera -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ valor: 800, comentario: "Caja inicial" });

    expect(res.status).toBe(201);
    expect(res.body.valor).toBe(800);
  });

  it("un propietario no puede registrar en una cartera ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraAjenaId}/inyecciones`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ valor: 100, comentario: "X" });

    expect(res.status).toBe(403);
  });

  it("POST /carteras/:id/inyecciones de una cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/999999/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 100, comentario: "X" });

    expect(res.status).toBe(404);
  });

  it.each([
    ["valor cero", { valor: 0, comentario: "X" }],
    ["valor negativo", { valor: -100, comentario: "X" }],
    ["comentario vacío", { valor: 100, comentario: "" }],
    ["comentario solo espacios", { valor: 100, comentario: "   " }],
  ])("POST /carteras/:id/inyecciones con %s -> 400", async (_nombre, payload) => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:id/inyecciones sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraPropiaId}/inyecciones`)
      .send({ valor: 100, comentario: "X" });

    expect(res.status).toBe(401);
  });
});
