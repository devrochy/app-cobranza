import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Edición de configuración de ruta (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let accessTokenAdmin: string;
  let tokenSocio: string;
  let rutaPropiaId: number;
  let rutaAjenaId: number;

  const ADMIN_USERNAME = "ecr-e2e-admin";
  const ADMIN_PASSWORD = "ecr-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));

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
      usuario: "socio-ecr-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-ecr-1@correo.com",
      telefono: "+59171120001",
      codigo: "SC-ECR-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const socio2 = await socioRepo.save({
      usuario: "socio-ecr-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-ecr-2@correo.com",
      telefono: "+59171120002",
      codigo: "SC-ECR-2",
      moneda: "BOB",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/socios/${socio.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_ruta: true } });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-ecr-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-ecr-1@correo.com",
      telefono: "+59172230001",
      codigo: "CB-ECR-1",
      estatus: "activo",
    });
    const cobrador2 = await cobradorRepo.save({
      socio: { id: socio2.id },
      usuario: "cobrador-ecr-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-ecr-2@correo.com",
      telefono: "+59172230002",
      codigo: "CB-ECR-2",
      estatus: "activo",
    });

    const rutaPropia = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta ECR-1",
      descripcion: "Zona 1",
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaPropiaId = rutaPropia.id;

    const rutaAjena = await rutaRepo.save({
      socio: { id: socio2.id },
      cobrador: { id: cobrador2.id },
      nombre: "Ruta ECR-2",
      descripcion: "Zona 2",
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaAjenaId = rutaAjena.id;

    tokenSocio = await loginSocio("socio-ecr-1");
  });

  afterAll(async () => {
    await rutaRepo.delete({ id: rutaPropiaId });
    await rutaRepo.delete({ id: rutaAjenaId });
    await cobradorRepo.delete({ codigo: "CB-ECR-1" });
    await cobradorRepo.delete({ codigo: "CB-ECR-2" });
    await socioRepo.delete({ codigo: "SC-ECR-1" });
    await socioRepo.delete({ codigo: "SC-ECR-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("PATCH /rutas/:id/configuracion actualiza interés y cuotas sin tocar metadata", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ tipoInteres: 25, numCuotas: 10 });

    expect(res.status).toBe(200);
    expect(res.body.tipoInteres).toBe(25);
    expect(res.body.numCuotas).toBe(10);
    expect(res.body.nombre).toBe("Ruta ECR-1");
    expect(res.body.moneda).toBe("BOB");
    expect(res.body.estatus).toBe("activo");
  });

  it("un socio con configurar_ruta edita la configuración de su ruta -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ tipoInteres: 30 });

    expect(res.status).toBe(200);
    expect(res.body.tipoInteres).toBe(30);
  });

  it("un socio no puede editar la configuración de una ruta ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaAjenaId}/configuracion`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ tipoInteres: 99 });

    expect(res.status).toBe(403);
  });

  it("PATCH /rutas/:id/configuracion con body vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("PATCH /rutas/:id/configuracion con valores fuera de rango -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ tipoInteres: 0, numCuotas: 0 });

    expect(res.status).toBe(400);
  });

  it("PATCH /rutas/:id/configuracion de ruta inexistente con body vacío -> 400 (precedencia de validación)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/999999/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("PATCH /rutas/:id/configuracion con moneda -> 400 (no editable)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ tipoInteres: 25, moneda: "COP" });

    expect(res.status).toBe(400);
  });

  it("PATCH /rutas/:id/configuracion de una ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/999999/configuracion`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ tipoInteres: 25 });

    expect(res.status).toBe(404);
  });

  it("PATCH /rutas/:id/configuracion sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}/configuracion`)
      .send({ tipoInteres: 25 });

    expect(res.status).toBe(401);
  });
});
