import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Caja } from "../../src/modules/rutas/caja.entity";
import { Inyeccion } from "../../src/modules/rutas/inyeccion.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Registro de inyecciones de capital (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let inyRepo: Repository<Inyeccion>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let tokenSocio: string;
  let rutaPropiaId: number;
  let rutaAjenaId: number;

  const ADMIN_USERNAME = "iny-e2e-admin";
  const ADMIN_PASSWORD = "iny-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    inyRepo = moduleFixture.get(getRepositoryToken(Inyeccion));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));

    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await inyRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-INY-1" });
    await cobradorRepo.delete({ codigo: "CB-INY-2" });
    await socioRepo.delete({ codigo: "SC-INY-1" });
    await socioRepo.delete({ codigo: "SC-INY-2" });
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
      usuario: "socio-iny-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-iny-1@correo.com",
      telefono: "+59171140001",
      codigo: "SC-INY-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const socio2 = await socioRepo.save({
      usuario: "socio-iny-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-iny-2@correo.com",
      telefono: "+59171140002",
      codigo: "SC-INY-2",
      moneda: "BOB",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/socios/${socio.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_ruta: true } });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-iny-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-iny-1@correo.com",
      telefono: "+59172250001",
      codigo: "CB-INY-1",
      estatus: "activo",
    });
    const cobrador2 = await cobradorRepo.save({
      socio: { id: socio2.id },
      usuario: "cobrador-iny-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-iny-2@correo.com",
      telefono: "+59172250002",
      codigo: "CB-INY-2",
      estatus: "activo",
    });

    const rutaPropia = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta INY-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaPropiaId = rutaPropia.id;
    await cajaRepo.save({
      ruta: { id: rutaPropiaId },
      rutaId: rutaPropiaId,
      saldoInicial: 1000,
      saldoActual: 1000,
    });

    const rutaAjena = await rutaRepo.save({
      socio: { id: socio2.id },
      cobrador: { id: cobrador2.id },
      nombre: "Ruta INY-2",
      descripcion: null,
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaAjenaId = rutaAjena.id;
    await cajaRepo.save({
      ruta: { id: rutaAjenaId },
      rutaId: rutaAjenaId,
      saldoInicial: 500,
      saldoActual: 500,
    });

    tokenSocio = await loginSocio("socio-iny-1");
  });

  afterAll(async () => {
    await inyRepo.delete({ ruta: { id: rutaPropiaId } });
    await inyRepo.delete({ ruta: { id: rutaAjenaId } });
    await rutaRepo.delete({ id: rutaPropiaId });
    await rutaRepo.delete({ id: rutaAjenaId });
    await cobradorRepo.delete({ codigo: "CB-INY-1" });
    await cobradorRepo.delete({ codigo: "CB-INY-2" });
    await socioRepo.delete({ codigo: "SC-INY-1" });
    await socioRepo.delete({ codigo: "SC-INY-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas/:id/inyecciones como admin -> 201 con estado activa y fechaHora", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 1500, comentario: "Aporte semanal" });

    expect(res.status).toBe(201);
    expect(res.body.valor).toBe(1500);
    expect(res.body.comentario).toBe("Aporte semanal");
    expect(res.body.estado).toBe("activa");
    expect(() => new Date(res.body.fechaHora).toISOString()).not.toThrow();
    expect(res.body.rutaId).toBe(rutaPropiaId);
  });

  it("la inyección aumenta el saldo real de la caja de la ruta (wiring)", async () => {
    await request(app.getHttpServer())
      .post(`/rutas/${rutaPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 300, comentario: "Aporte wiring" });

    const caja = await cajaRepo
      .createQueryBuilder("c")
      .where("c.ruta_id = :rutaId", { rutaId: rutaPropiaId })
      .getOne();
    // saldo inicial 1000 + 1500 (test anterior) + 300 = 2800
    expect(caja?.saldoActual).toBe(2800);
  });

  it("un socio con configurar_ruta registra en su propia ruta -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ valor: 800, comentario: "Caja inicial" });

    expect(res.status).toBe(201);
    expect(res.body.valor).toBe(800);
  });

  it("un socio no puede registrar en una ruta ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaAjenaId}/inyecciones`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ valor: 100, comentario: "X" });

    expect(res.status).toBe(403);
  });

  it("POST /rutas/:id/inyecciones de una ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/999999/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 100, comentario: "X" });

    expect(res.status).toBe(404);
  });

  it.each([
    ["valor cero", { valor: 0, comentario: "X" }],
    ["valor negativo", { valor: -100, comentario: "X" }],
    ["comentario vacío", { valor: 100, comentario: "" }],
    ["comentario solo espacios", { valor: 100, comentario: "   " }],
  ])("POST /rutas/:id/inyecciones con %s -> 400", async (_nombre, payload) => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it("POST /rutas/:id/inyecciones sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaPropiaId}/inyecciones`)
      .send({ valor: 100, comentario: "X" });

    expect(res.status).toBe(401);
  });
});
