import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Caja } from "../../src/modules/rutas/caja.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Registro y gestión de rutas (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let tokenSocio: string;
  let socioId: number;
  let otroSocioId: number;
  let cobradorId: number;
  let cobrador2Id: number;
  let rutaId: number;

  const ADMIN_USERNAME = "rutas-e2e-admin";
  const ADMIN_PASSWORD = "rutas-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "rutas-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "rutas-e2e-refresh-secret";
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
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));

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
      usuario: "socio-rt-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Ruiz",
      correo: "socio-rt-1@correo.com",
      telefono: "+59171111111",
      codigo: "SC-RT-1",
      moneda: "BOB",
      estatus: "activo",
    });
    socioId = socio.id;

    const otroSocio = await socioRepo.save({
      usuario: "socio-rt-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Luis",
      apellido: "Mora",
      correo: "socio-rt-2@correo.com",
      telefono: "+59171111112",
      codigo: "SC-RT-2",
      moneda: "BOB",
      estatus: "activo",
    });
    otroSocioId = otroSocio.id;

    await request(app.getHttpServer())
      .put(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { registrar_ruta: true, configurar_ruta: true, ver_reportes: true } });

    const cobrador = await cobradorRepo.save({
      socio: { id: socioId },
      usuario: "cobrador-rt-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "López",
      correo: "cobrador-rt-1@correo.com",
      telefono: "+59172222221",
      codigo: "CB-RT-1",
      estatus: "activo",
    });
    cobradorId = cobrador.id;

    const cobrador2 = await cobradorRepo.save({
      socio: { id: socioId },
      usuario: "cobrador-rt-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Pedro",
      apellido: "Gómez",
      correo: "cobrador-rt-2@correo.com",
      telefono: "+59172222222",
      codigo: "CB-RT-2",
      estatus: "activo",
    });
    cobrador2Id = cobrador2.id;

    tokenSocio = await loginSocio("socio-rt-1");
  });

  afterAll(async () => {
    await rutaRepo.delete({ cobrador: { id: cobradorId } });
    await rutaRepo.delete({ cobrador: { id: cobrador2Id } });
    await cobradorRepo.delete({ id: cobradorId });
    await cobradorRepo.delete({ id: cobrador2Id });
    await socioRepo.delete({ id: socioId });
    await socioRepo.delete({ id: otroSocioId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas como admin -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta E2E",
        descripcion: "Zona de prueba",
        socioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe("Ruta E2E");
    expect(res.body.tipoInteres).toBe(20);
    expect(res.body.costoCobro).toBe(250);
    rutaId = res.body.id as number;
  });

  it("POST /rutas sin costoCobro -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta Sin Costo",
        socioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
      });

    expect(res.status).toBe(400);
  });

  it("POST /rutas con costoCobro negativo -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta Costo Negativo",
        socioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: -10,
      });

    expect(res.status).toBe(400);
  });

  it("crea la caja de la ruta con el saldo inicial al registrar", async () => {
    const caja = await cajaRepo
      .createQueryBuilder("c")
      .where("c.ruta_id = :rutaId", { rutaId })
      .getOne();
    expect(caja?.saldoInicial).toBe(1000);
    expect(caja?.saldoActual).toBe(1000);
  });

  it("GET /rutas/:id/caja devuelve el saldo de la caja", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/caja`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.rutaId).toBe(rutaId);
    expect(res.body.saldoInicial).toBe(1000);
    expect(res.body.saldoActual).toBe(1000);
  });

  it("GET /rutas/:id/caja de una ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/999999/caja`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /rutas/:id/caja sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/rutas/${rutaId}/caja`);

    expect(res.status).toBe(401);
  });

  it("un socio con registrar_ruta crea ruta bajo su socio -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({
        nombre: "Ruta Socio",
        socioId,
        cobradorId,
        tipoInteres: 25,
        numCuotas: 10,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(201);
    expect(res.body.socioId).toBe(socioId);
  });

  it("un socio con ver_reportes consulta la caja de su propia ruta -> 200", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/caja`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(200);
    expect(res.body.rutaId).toBe(rutaId);
    expect(res.body.saldoActual).toBe(1000);
  });

  it("un socio sin ver_reportes no consulta la caja -> 403", async () => {
    const socioSinVer = await socioRepo.save({
      usuario: "socio-rt-sinver",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "SinVer",
      correo: "socio-rt-sinver@correo.com",
      telefono: "+59171160088",
      codigo: "SC-RT-SINVER",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-rt-sinver", password: PASSWORD });
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/caja`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinVer.id });
  });

  it("un socio no puede crear ruta bajo otro socio -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({
        nombre: "Ruta Ajeno",
        socioId: otroSocioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(403);
  });

  it("POST /rutas con cobrador de otro socio -> 403 (socio)", async () => {
    const cobradorAjeno = await cobradorRepo.save({
      socio: { id: otroSocioId },
      usuario: "cobrador-rt-3",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Rosa",
      apellido: "Díaz",
      correo: "cobrador-rt-3@correo.com",
      telefono: "+59172222223",
      codigo: "CB-RT-3",
      estatus: "activo",
    });

    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({
        nombre: "Ruta Cobrador Ajeno",
        socioId,
        cobradorId: cobradorAjeno.id,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(403);
    await cobradorRepo.delete({ id: cobradorAjeno.id });
  });

  it("POST /rutas con cobrador bloqueado -> 409", async () => {
    await request(app.getHttpServer())
      .patch(`/cobradores/${cobradorId}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "bloqueado" });

    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta Bloqueada",
        socioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(409);
  });

  it("la cascada bloquea las rutas del cobrador y las reactiva al reactivarlo", async () => {
    const creada = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta Cascada",
        socioId,
        cobradorId: cobrador2Id,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    const cascadaRutaId = creada.body.id as number;

    await request(app.getHttpServer())
      .patch(`/cobradores/${cobrador2Id}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "bloqueado" });

    let fila = await rutaRepo.findOne({ where: { id: cascadaRutaId } });
    expect(fila?.estatus).toBe("bloqueado");

    await request(app.getHttpServer())
      .patch(`/cobradores/${cobrador2Id}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "activo" });

    fila = await rutaRepo.findOne({ where: { id: cascadaRutaId } });
    expect(fila?.estatus).toBe("activo");
  });

  it("PATCH /rutas/:id/estatus reactiva manualmente", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("bloqueado");
  });

  it("PATCH /rutas/:id/cobrador reasigna la ruta", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/cobrador`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cobradorId: cobrador2Id });

    expect(res.status).toBe(200);
    expect(res.body.cobradorId).toBe(cobrador2Id);
    expect(res.body.estatus).toBe("activo");
  });

  it("PATCH /rutas/:id/cobrador de un cobrador ajeno -> 409", async () => {
    const cobradorAjeno = await cobradorRepo.save({
      socio: { id: otroSocioId },
      usuario: "cobrador-rt-4",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Lina",
      apellido: "Peña",
      correo: "cobrador-rt-4@correo.com",
      telefono: "+59172222224",
      codigo: "CB-RT-4",
      estatus: "activo",
    });

    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/cobrador`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cobradorId: cobradorAjeno.id });

    expect(res.status).toBe(409);
    await cobradorRepo.delete({ id: cobradorAjeno.id });
  });

  it("POST /rutas con datos inválidos -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta Inválida",
        socioId,
        cobradorId,
        tipoInteres: 0,
        numCuotas: 0,
        moneda: "peso",
      });

    expect(res.status).toBe(400);
  });

  it("POST /rutas sin saldoInicial -> 400 (obligatorio, HU-08)", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta Sin Saldo",
        socioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
      });

    expect(res.status).toBe(400);
  });

  it("POST /rutas con saldoInicial negativo -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta Saldo Negativo",
        socioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: -50,
      });

    expect(res.status).toBe(400);
  });

  it("POST /rutas sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/rutas")
      .send({
        nombre: "Ruta X",
        socioId,
        cobradorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
      });

    expect(res.status).toBe(401);
  });


  describe("GET /rutas (listado)", () => {
    let rutaBloqueadaId: number;

    beforeAll(async () => {
      // El test de cascada previo deja CB-RT-1 bloqueado; se reactiva para
      // poder crear una ruta con él en este bloque.
      await request(app.getHttpServer())
        .patch(`/cobradores/${cobradorId}/estatus`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ estatus: "activo" });

      // Desacopla el filtro por estatus del orden de los tests: garantiza que
      // "Ruta E2E" esté activa al ejecutar este bloque (el test de reasignación
      // previo también la deja activa, pero no debe depender de eso).
      await request(app.getHttpServer())
        .patch(`/rutas/${rutaId}/estatus`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ estatus: "activo" });

      const creada = await request(app.getHttpServer())
        .post("/rutas")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({
          nombre: "Ruta Bloqueada",
          socioId,
          cobradorId,
          tipoInteres: 20,
          numCuotas: 8,
          moneda: "BOB",
          saldoInicial: 500,
          costoCobro: 200,
        });
      rutaBloqueadaId = creada.body.id as number;
      await request(app.getHttpServer())
        .patch(`/rutas/${rutaBloqueadaId}/estatus`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ estatus: "bloqueado" });
    });

    afterAll(async () => {
      await rutaRepo.delete({ id: rutaBloqueadaId });
    });

    it("devuelve todas las rutas como admin", async () => {
      const res = await request(app.getHttpServer())
        .get("/rutas")
        .set("Authorization", `Bearer ${accessTokenAdmin}`);

      expect(res.status).toBe(200);
      const nombres = res.body.map((r: { nombre: string }) => r.nombre);
      expect(nombres).toContain("Ruta E2E");
      expect(nombres).toContain("Ruta Bloqueada");
    });

    it("filtra por busqueda (ILIKE)", async () => {
      const res = await request(app.getHttpServer())
        .get("/rutas")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ busqueda: "Ruta E2E" });

      expect(res.status).toBe(200);
      const nombres = res.body.map((r: { nombre: string }) => r.nombre);
      expect(nombres).toContain("Ruta E2E");
      expect(nombres).not.toContain("Ruta Bloqueada");
    });

    it("filtra por estatus", async () => {
      const res = await request(app.getHttpServer())
        .get("/rutas")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ estatus: "bloqueado" });

      expect(res.status).toBe(200);
      const nombres = res.body.map((r: { nombre: string }) => r.nombre);
      expect(nombres).toContain("Ruta Bloqueada");
      expect(nombres).not.toContain("Ruta E2E");
    });

    it("rechaza un estatus inválido con 400", async () => {
      const res = await request(app.getHttpServer())
        .get("/rutas")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ estatus: "pendiente" });

      expect(res.status).toBe(400);
    });

    it("responde 401 sin token", async () => {
      const res = await request(app.getHttpServer()).get("/rutas");
      expect(res.status).toBe(401);
    });

    it("un socio ve solo sus rutas (ownership)", async () => {
      const login = await request(app.getHttpServer())
        .post("/auth/socio/login")
        .send({ usuario: "socio-rt-1", password: "password-seguro" });
      const tokenSocio = login.body.accessToken as string;

      const res = await request(app.getHttpServer())
        .get("/rutas")
        .set("Authorization", `Bearer ${tokenSocio}`);

      expect(res.status).toBe(200);
      const rutas = res.body as { socioId: number }[];
      expect(rutas.length).toBeGreaterThan(0);
      expect(rutas.every((r) => r.socioId === socioId)).toBe(true);
    });
  });
});
