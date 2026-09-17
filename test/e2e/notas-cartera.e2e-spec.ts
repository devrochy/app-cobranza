import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { CarteraNota } from "../../src/modules/carteras/cartera-nota.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Notas de cartera (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let notaRepo: Repository<CarteraNota>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let propietarioDueñoId: number;

  const ADMIN_USERNAME = "notas-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Notas2026";
  const PASSWORD = "Propietario#Notas2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-notas";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-notas";
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
    notaRepo = moduleFixture.get(getRepositoryToken(CarteraNota));

    await notaRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-NOTAS-1" });
    await propietarioRepo.delete({ codigo: "SC-NOTAS-1" });
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
      usuario: "propietario-notas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-notas-1@correo.com",
      telefono: "+59171160044",
      codigo: "SC-NOTAS-1",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioDueñoId = propietario.id;

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-notas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-notas-1@correo.com",
      telefono: "+59172270044",
      codigo: "CB-NOTAS-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera NOTAS",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;
  });

  afterAll(async () => {
    await notaRepo.createQueryBuilder().delete().execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-NOTAS-1" });
    await propietarioRepo.delete({ codigo: "SC-NOTAS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /carteras/:id/notas crea la nota y registra el autor", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "Cliente no disponible esta semana" });

    expect(res.status).toBe(201);
    expect(res.body.nota).toBe("Cliente no disponible esta semana");
    expect(res.body.carteraId).toBe(carteraId);
    expect(res.body.creadoPorRol).toBe("admin");
    expect(res.body.creadoPorId).toBeDefined();
  });

  it("GET /carteras/:id/notas lista las notas", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("PATCH /carteras/:id/notas/:notaId edita la nota sobreescribiendo el texto", async () => {
    const creada = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "Versión original" });
    const notaId = creada.body.id as number;

    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/notas/${notaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "Versión editada" });

    expect(res.status).toBe(200);
    expect(res.body.nota).toBe("Versión editada");

    const enDb = await notaRepo.findOne({ where: { id: notaId } });
    expect(enDb?.nota).toBe("Versión editada");
  });

  it("DELETE /carteras/:id/notas/:notaId elimina la nota físicamente", async () => {
    const creada = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "Nota a borrar" });
    const notaId = creada.body.id as number;

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/notas/${notaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(notaId);

    const enDb = await notaRepo.findOne({ where: { id: notaId } });
    expect(enDb).toBeNull();
  });

  it("POST /carteras/:id/notas con nota vacía -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "" });

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:id/notas con campo extra -> 400 (forbidNonWhitelisted)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "válida", extra: "no" });

    expect(res.status).toBe(400);
  });

  it("PATCH /carteras/:id/notas/:notaId con nota inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/notas/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "x" });

    expect(res.status).toBe(404);
  });

  it("un propietario SIN anotar_notas_cartera no puede crear notas -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-notas-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-notas-2@correo.com",
      telefono: "+59171160045",
      codigo: "SC-NOTAS-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-notas-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ nota: "intento sin permiso" });

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });

  it("POST /carteras/:id/notas sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .send({ nota: "x" });

    expect(res.status).toBe(401);
  });

  it("PATCH actualiza updated_at (sin historial, sobreescribe)", async () => {
    const creada = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "antes" });
    const notaId = creada.body.id as number;
    const antes = (await notaRepo.findOne({ where: { id: notaId } }))?.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/notas/${notaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "después" });

    const despues = (await notaRepo.findOne({ where: { id: notaId } }))?.updatedAt;
    expect(antes).toBeDefined();
    expect(despues).toBeDefined();
    expect(despues!.getTime()).toBeGreaterThan(antes!.getTime());
  });

  it("un propietario CON anotar_notas_cartera opera sobre su propia cartera", async () => {
    await request(app.getHttpServer())
      .put(`/propietarios/${propietarioDueñoId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { anotar_notas_cartera: true } });

    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-notas-1", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const crear = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ nota: "nota del propietario" });
    expect(crear.status).toBe(201);
    expect(crear.body.creadoPorRol).toBe("propietario");
    expect(crear.body.creadoPorId).toBe(propietarioDueñoId);

    const editar = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/notas/${crear.body.id}`)
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({ nota: "editada por propietario" });
    expect(editar.status).toBe(200);
    expect(editar.body.nota).toBe("editada por propietario");

    const eliminar = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/notas/${crear.body.id}`)
      .set("Authorization", `Bearer ${tokenPropietario}`);
    expect(eliminar.status).toBe(200);
  });

  it("POST /carteras/:id/notas con nota de solo espacios -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "   " });

    expect(res.status).toBe(400);
  });
});