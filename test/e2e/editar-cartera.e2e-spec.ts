import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Edición de información de cartera (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let accessTokenAdmin: string;
  let tokenPropietario: string;
  let carteraPropiaId: number;
  let carteraAjenaId: number;

  const ADMIN_USERNAME = "edr-e2e-admin";
  const ADMIN_PASSWORD = "edr-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  async function crearPropietario(usuario: string, codigo: string, correo: string, telefono: string): Promise<Propietario> {
    return propietarioRepo.save({
      usuario,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo,
      telefono,
      codigo,
      moneda: "BOB",
      estatus: "activo",
    });
  }

  async function crearGestor(propietarioId: number, codigo: string, telefono: string): Promise<Gestor> {
    return gestorRepo.save({
      propietario: { id: propietarioId },
      usuario: codigo.toLowerCase(),
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: `${codigo.toLowerCase()}@correo.com`,
      telefono,
      codigo,
      estatus: "activo",
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "edr-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "edr-e2e-refresh-secret";
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

    const propietario = await crearPropietario("propietario-edr-1", "SC-EDR-1", "propietario-edr-1@correo.com", "+59171110001");
    const propietario2 = await crearPropietario("propietario-edr-2", "SC-EDR-2", "propietario-edr-2@correo.com", "+59171110002");

    await request(app.getHttpServer())
      .put(`/propietarios/${propietario.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_cartera: true } });

    const gestor = await crearGestor(propietario.id, "CB-EDR-1", "+59172220001");
    const gestor2 = await crearGestor(propietario2.id, "CB-EDR-2", "+59172220002");

    const carteraPropia = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera EDR-1",
      descripcion: "Zona 1",
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraPropiaId = carteraPropia.id;

    const carteraAjena = await carteraRepo.save({
      propietario: { id: propietario2.id },
      gestor: { id: gestor2.id },
      nombre: "Cartera EDR-2",
      descripcion: "Zona 2",
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraAjenaId = carteraAjena.id;

    tokenPropietario = await loginPropietario("propietario-edr-1");
  });

  afterAll(async () => {
    await carteraRepo.delete({ id: carteraPropiaId });
    await carteraRepo.delete({ id: carteraAjenaId });
    await gestorRepo.delete({ codigo: "CB-EDR-1" });
    await gestorRepo.delete({ codigo: "CB-EDR-2" });
    await propietarioRepo.delete({ codigo: "SC-EDR-1" });
    await propietarioRepo.delete({ codigo: "SC-EDR-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("PATCH /carteras/:id renombra y edita descripción sin alterar la configuración", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "Cartera Norte", descripcion: "Nueva zona" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Cartera Norte");
    expect(res.body.descripcion).toBe("Nueva zona");
    expect(res.body.gestorId).toBeDefined();
    expect(res.body.tipoInteres).toBe(20);
    expect(res.body.numCuotas).toBe(8);
    expect(res.body.moneda).toBe("BOB");
    expect(res.body.estatus).toBe("activo");
  });

  it("un propietario con configurar_cartera edita su propia cartera -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ nombre: "Cartera Norte v2" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Cartera Norte v2");
  });

  it("un propietario no puede editar una cartera ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraAjenaId}`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ nombre: "Hack" });

    expect(res.status).toBe(403);
  });

  it("un propietario SIN configurar_cartera no puede editar ninguna cartera -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-edr-3",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-edr-3@correo.com",
      telefono: "+59171110003",
      codigo: "SC-EDR-3",
      moneda: "BOB",
      estatus: "activo",
    });
    const token = await loginPropietario("propietario-edr-3");

    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });

  it("PATCH /carteras/:id con campos de configuración -> 400 (forbidNonWhitelisted)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "X", tipoInteres: 99 });

    expect(res.status).toBe(400);
  });

  it("PATCH /carteras/:id con descripcion null la limpia -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "Cartera Norte v2", descripcion: null });

    expect(res.status).toBe(200);
    expect(res.body.descripcion).toBeNull();
  });

  it("PATCH /carteras/:id de una cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(404);
  });

  it("PATCH /carteras/:id con nombre vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "" });

    expect(res.status).toBe(400);
  });

  it("PATCH /carteras/:id sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(401);
  });
});
