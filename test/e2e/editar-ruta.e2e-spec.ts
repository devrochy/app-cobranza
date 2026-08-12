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

describe("Edición de información de ruta (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let accessTokenAdmin: string;
  let tokenSocio: string;
  let rutaPropiaId: number;
  let rutaAjenaId: number;

  const ADMIN_USERNAME = "edr-e2e-admin";
  const ADMIN_PASSWORD = "edr-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  async function crearSocio(usuario: string, codigo: string, correo: string, telefono: string): Promise<Socio> {
    return socioRepo.save({
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

  async function crearCobrador(socioId: number, codigo: string, telefono: string): Promise<Cobrador> {
    return cobradorRepo.save({
      socio: { id: socioId },
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

    const socio = await crearSocio("socio-edr-1", "SC-EDR-1", "socio-edr-1@correo.com", "+59171110001");
    const socio2 = await crearSocio("socio-edr-2", "SC-EDR-2", "socio-edr-2@correo.com", "+59171110002");

    await request(app.getHttpServer())
      .put(`/socios/${socio.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_ruta: true } });

    const cobrador = await crearCobrador(socio.id, "CB-EDR-1", "+59172220001");
    const cobrador2 = await crearCobrador(socio2.id, "CB-EDR-2", "+59172220002");

    const rutaPropia = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta EDR-1",
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
      nombre: "Ruta EDR-2",
      descripcion: "Zona 2",
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaAjenaId = rutaAjena.id;

    tokenSocio = await loginSocio("socio-edr-1");
  });

  afterAll(async () => {
    await rutaRepo.delete({ id: rutaPropiaId });
    await rutaRepo.delete({ id: rutaAjenaId });
    await cobradorRepo.delete({ codigo: "CB-EDR-1" });
    await cobradorRepo.delete({ codigo: "CB-EDR-2" });
    await socioRepo.delete({ codigo: "SC-EDR-1" });
    await socioRepo.delete({ codigo: "SC-EDR-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("PATCH /rutas/:id renombra y edita descripción sin alterar la configuración", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "Ruta Norte", descripcion: "Nueva zona" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Ruta Norte");
    expect(res.body.descripcion).toBe("Nueva zona");
    expect(res.body.cobradorId).toBeDefined();
    expect(res.body.tipoInteres).toBe(20);
    expect(res.body.numCuotas).toBe(8);
    expect(res.body.moneda).toBe("BOB");
    expect(res.body.estatus).toBe("activo");
  });

  it("un socio con configurar_ruta edita su propia ruta -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ nombre: "Ruta Norte v2" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Ruta Norte v2");
  });

  it("un socio no puede editar una ruta ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaAjenaId}`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ nombre: "Hack" });

    expect(res.status).toBe(403);
  });

  it("un socio SIN configurar_ruta no puede editar ninguna ruta -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-edr-3",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-edr-3@correo.com",
      telefono: "+59171110003",
      codigo: "SC-EDR-3",
      moneda: "BOB",
      estatus: "activo",
    });
    const token = await loginSocio("socio-edr-3");

    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });

  it("PATCH /rutas/:id con campos de configuración -> 400 (forbidNonWhitelisted)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "X", tipoInteres: 99 });

    expect(res.status).toBe(400);
  });

  it("PATCH /rutas/:id con descripcion null la limpia -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "Ruta Norte v2", descripcion: null });

    expect(res.status).toBe(200);
    expect(res.body.descripcion).toBeNull();
  });

  it("PATCH /rutas/:id de una ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(404);
  });

  it("PATCH /rutas/:id con nombre vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "" });

    expect(res.status).toBe(400);
  });

  it("PATCH /rutas/:id sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaPropiaId}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(401);
  });
});
