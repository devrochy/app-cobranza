import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { RutaNota } from "../../src/modules/rutas/ruta-nota.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Notas de ruta (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let notaRepo: Repository<RutaNota>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let socioDueñoId: number;

  const ADMIN_USERNAME = "notas-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Notas2026";
  const PASSWORD = "Socio#Notas2026";

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    notaRepo = moduleFixture.get(getRepositoryToken(RutaNota));

    await notaRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-NOTAS-1" });
    await socioRepo.delete({ codigo: "SC-NOTAS-1" });
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
      usuario: "socio-notas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-notas-1@correo.com",
      telefono: "+59171160044",
      codigo: "SC-NOTAS-1",
      moneda: "BOB",
      estatus: "activo",
    });
    socioDueñoId = socio.id;

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-notas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-notas-1@correo.com",
      telefono: "+59172270044",
      codigo: "CB-NOTAS-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta NOTAS",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;
  });

  afterAll(async () => {
    await notaRepo.createQueryBuilder().delete().execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-NOTAS-1" });
    await socioRepo.delete({ codigo: "SC-NOTAS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas/:id/notas crea la nota y registra el autor", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "Cliente no disponible esta semana" });

    expect(res.status).toBe(201);
    expect(res.body.nota).toBe("Cliente no disponible esta semana");
    expect(res.body.rutaId).toBe(rutaId);
    expect(res.body.creadoPorRol).toBe("admin");
    expect(res.body.creadoPorId).toBeDefined();
  });

  it("GET /rutas/:id/notas lista las notas", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("PATCH /rutas/:id/notas/:notaId edita la nota sobreescribiendo el texto", async () => {
    const creada = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "Versión original" });
    const notaId = creada.body.id as number;

    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/notas/${notaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "Versión editada" });

    expect(res.status).toBe(200);
    expect(res.body.nota).toBe("Versión editada");

    const enDb = await notaRepo.findOne({ where: { id: notaId } });
    expect(enDb?.nota).toBe("Versión editada");
  });

  it("DELETE /rutas/:id/notas/:notaId elimina la nota físicamente", async () => {
    const creada = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "Nota a borrar" });
    const notaId = creada.body.id as number;

    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaId}/notas/${notaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(notaId);

    const enDb = await notaRepo.findOne({ where: { id: notaId } });
    expect(enDb).toBeNull();
  });

  it("POST /rutas/:id/notas con nota vacía -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "" });

    expect(res.status).toBe(400);
  });

  it("POST /rutas/:id/notas con campo extra -> 400 (forbidNonWhitelisted)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "válida", extra: "no" });

    expect(res.status).toBe(400);
  });

  it("PATCH /rutas/:id/notas/:notaId con nota inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/notas/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "x" });

    expect(res.status).toBe(404);
  });

  it("un socio SIN anotar_notas_ruta no puede crear notas -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-notas-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-notas-2@correo.com",
      telefono: "+59171160045",
      codigo: "SC-NOTAS-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-notas-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ nota: "intento sin permiso" });

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });

  it("POST /rutas/:id/notas sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .send({ nota: "x" });

    expect(res.status).toBe(401);
  });

  it("PATCH actualiza updated_at (sin historial, sobreescribe)", async () => {
    const creada = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "antes" });
    const notaId = creada.body.id as number;
    const antes = (await notaRepo.findOne({ where: { id: notaId } }))?.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/notas/${notaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "después" });

    const despues = (await notaRepo.findOne({ where: { id: notaId } }))?.updatedAt;
    expect(antes).toBeDefined();
    expect(despues).toBeDefined();
    expect(despues!.getTime()).toBeGreaterThan(antes!.getTime());
  });

  it("un socio CON anotar_notas_ruta opera sobre su propia ruta", async () => {
    await request(app.getHttpServer())
      .put(`/socios/${socioDueñoId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { anotar_notas_ruta: true } });

    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-notas-1", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const crear = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ nota: "nota del socio" });
    expect(crear.status).toBe(201);
    expect(crear.body.creadoPorRol).toBe("socio");
    expect(crear.body.creadoPorId).toBe(socioDueñoId);

    const editar = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/notas/${crear.body.id}`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ nota: "editada por socio" });
    expect(editar.status).toBe(200);
    expect(editar.body.nota).toBe("editada por socio");

    const eliminar = await request(app.getHttpServer())
      .delete(`/rutas/${rutaId}/notas/${crear.body.id}`)
      .set("Authorization", `Bearer ${tokenSocio}`);
    expect(eliminar.status).toBe(200);
  });

  it("POST /rutas/:id/notas con nota de solo espacios -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/notas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nota: "   " });

    expect(res.status).toBe(400);
  });
});