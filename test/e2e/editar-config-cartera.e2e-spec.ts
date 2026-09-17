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

describe("Edición de configuración de cartera (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let accessTokenAdmin: string;
  let tokenPropietario: string;
  let carteraPropiaId: number;
  let carteraAjenaId: number;

  const ADMIN_USERNAME = "ecr-e2e-admin";
  const ADMIN_PASSWORD = "ecr-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "ecr-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "ecr-e2e-refresh-secret";
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

    const propietario = await propietarioRepo.save({
      usuario: "propietario-ecr-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-ecr-1@correo.com",
      telefono: "+59171120001",
      codigo: "SC-ECR-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const propietario2 = await propietarioRepo.save({
      usuario: "propietario-ecr-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-ecr-2@correo.com",
      telefono: "+59171120002",
      codigo: "SC-ECR-2",
      moneda: "BOB",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/propietarios/${propietario.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_cartera: true } });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-ecr-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-ecr-1@correo.com",
      telefono: "+59172230001",
      codigo: "CB-ECR-1",
      estatus: "activo",
    });
    const gestor2 = await gestorRepo.save({
      propietario: { id: propietario2.id },
      usuario: "gestor-ecr-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-ecr-2@correo.com",
      telefono: "+59172230002",
      codigo: "CB-ECR-2",
      estatus: "activo",
    });

    const carteraPropia = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera ECR-1",
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
      nombre: "Cartera ECR-2",
      descripcion: "Zona 2",
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraAjenaId = carteraAjena.id;

    tokenPropietario = await loginPropietario("propietario-ecr-1");
  });

  afterAll(async () => {
    await carteraRepo.delete({ id: carteraPropiaId });
    await carteraRepo.delete({ id: carteraAjenaId });
    await gestorRepo.delete({ codigo: "CB-ECR-1" });
    await gestorRepo.delete({ codigo: "CB-ECR-2" });
    await propietarioRepo.delete({ codigo: "SC-ECR-1" });
    await propietarioRepo.delete({ codigo: "SC-ECR-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("PATCH /carteras/:id/configuracion actualiza interés y cuotas sin tocar metadata", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ tipoInteres: 25, numCuotas: 10 });

    expect(res.status).toBe(200);
    expect(res.body.tipoInteres).toBe(25);
    expect(res.body.numCuotas).toBe(10);
    expect(res.body.nombre).toBe("Cartera ECR-1");
    expect(res.body.moneda).toBe("BOB");
    expect(res.body.estatus).toBe("activo");
  });

  it("un propietario con configurar_cartera edita la configuración de su cartera -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ tipoInteres: 30 });

    expect(res.status).toBe(200);
    expect(res.body.tipoInteres).toBe(30);
  });

  it("un propietario no puede editar la configuración de una cartera ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraAjenaId}/configuracion`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ tipoInteres: 99 });

    expect(res.status).toBe(403);
  });

  it("PATCH /carteras/:id/configuracion con body vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("PATCH /carteras/:id/configuracion con valores fuera de rango -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ tipoInteres: 0, numCuotas: 0 });

    expect(res.status).toBe(400);
  });

  it("PATCH /carteras/:id/configuracion de cartera inexistente con body vacío -> 400 (precedencia de validación)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/999999/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("PATCH /carteras/:id/configuracion con moneda -> 400 (no editable)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ tipoInteres: 25, moneda: "COP" });

    expect(res.status).toBe(400);
  });

  it("PATCH /carteras/:id/configuracion de una cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/999999/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ tipoInteres: 25 });

    expect(res.status).toBe(404);
  });

  it("PATCH /carteras/:id/configuracion sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraPropiaId}/configuracion`)
      .send({ tipoInteres: 25 });

    expect(res.status).toBe(401);
  });
});
