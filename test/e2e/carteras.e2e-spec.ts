import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Caja } from "../../src/modules/carteras/caja.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Registro y gestión de carteras (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let tokenPropietario: string;
  let propietarioId: number;
  let otroPropietarioId: number;
  let gestorId: number;
  let gestor2Id: number;
  let carteraId: number;

  const ADMIN_USERNAME = "carteras-e2e-admin";
  const ADMIN_PASSWORD = "carteras-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "carteras-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "carteras-e2e-refresh-secret";
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

    const propietario = await propietarioRepo.save({
      usuario: "propietario-rt-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Ruiz",
      correo: "propietario-rt-1@correo.com",
      telefono: "+59171111111",
      codigo: "SC-RT-1",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioId = propietario.id;

    const otroPropietario = await propietarioRepo.save({
      usuario: "propietario-rt-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Luis",
      apellido: "Mora",
      correo: "propietario-rt-2@correo.com",
      telefono: "+59171111112",
      codigo: "SC-RT-2",
      moneda: "BOB",
      estatus: "activo",
    });
    otroPropietarioId = otroPropietario.id;

    await request(app.getHttpServer())
      .put(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { registrar_cartera: true, configurar_cartera: true, ver_reportes: true } });

    const gestor = await gestorRepo.save({
      propietario: { id: propietarioId },
      usuario: "gestor-rt-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Carlos",
      apellido: "López",
      correo: "gestor-rt-1@correo.com",
      telefono: "+59172222221",
      codigo: "CB-RT-1",
      estatus: "activo",
    });
    gestorId = gestor.id;

    const gestor2 = await gestorRepo.save({
      propietario: { id: propietarioId },
      usuario: "gestor-rt-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Pedro",
      apellido: "Gómez",
      correo: "gestor-rt-2@correo.com",
      telefono: "+59172222222",
      codigo: "CB-RT-2",
      estatus: "activo",
    });
    gestor2Id = gestor2.id;

    tokenPropietario = await loginPropietario("propietario-rt-1");
  });

  afterAll(async () => {
    await carteraRepo.delete({ gestor: { id: gestorId } });
    await carteraRepo.delete({ gestor: { id: gestor2Id } });
    await gestorRepo.delete({ id: gestorId });
    await gestorRepo.delete({ id: gestor2Id });
    await propietarioRepo.delete({ id: propietarioId });
    await propietarioRepo.delete({ id: otroPropietarioId });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /carteras como admin -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera E2E",
        descripcion: "Zona de prueba",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe("Cartera E2E");
    expect(res.body.tipoInteres).toBe(20);
    expect(res.body.costoCobro).toBe(250);
    carteraId = res.body.id as number;
  });

  it("POST /carteras sin costoCobro -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera Sin Costo",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
      });

    expect(res.status).toBe(400);
  });

  it("POST /carteras con costoCobro negativo -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera Costo Negativo",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: -10,
      });

    expect(res.status).toBe(400);
  });

  it("crea la caja de la cartera con el saldo inicial al registrar", async () => {
    const caja = await cajaRepo
      .createQueryBuilder("c")
      .where("c.cartera_id = :carteraId", { carteraId })
      .getOne();
    expect(caja?.saldoInicial).toBe(1000);
    expect(caja?.saldoActual).toBe(1000);
  });

  it("GET /carteras/:id/caja devuelve el saldo de la caja", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/caja`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.carteraId).toBe(carteraId);
    expect(res.body.saldoInicial).toBe(1000);
    expect(res.body.saldoActual).toBe(1000);
  });

  it("GET /carteras/:id/caja de una cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/999999/caja`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /carteras/:id/caja sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraId}/caja`);

    expect(res.status).toBe(401);
  });

  it("un propietario con registrar_cartera crea cartera bajo su propietario -> 201", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({
        nombre: "Cartera Propietario",
        propietarioId,
        gestorId,
        tipoInteres: 25,
        numCuotas: 10,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(201);
    expect(res.body.propietarioId).toBe(propietarioId);
  });

  it("un propietario con ver_reportes consulta la caja de su propia cartera -> 200", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/caja`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(200);
    expect(res.body.carteraId).toBe(carteraId);
    expect(res.body.saldoActual).toBe(1000);
  });

  it("un propietario sin ver_reportes no consulta la caja -> 403", async () => {
    const propietarioSinVer = await propietarioRepo.save({
      usuario: "propietario-rt-sinver",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "SinVer",
      correo: "propietario-rt-sinver@correo.com",
      telefono: "+59171160088",
      codigo: "SC-RT-SINVER",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-rt-sinver", password: PASSWORD });
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/caja`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinVer.id });
  });

  it("un propietario no puede crear cartera bajo otro propietario -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({
        nombre: "Cartera Ajeno",
        propietarioId: otroPropietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(403);
  });

  it("POST /carteras con gestor de otro propietario -> 403 (propietario)", async () => {
    const gestorAjeno = await gestorRepo.save({
      propietario: { id: otroPropietarioId },
      usuario: "gestor-rt-3",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Rosa",
      apellido: "Díaz",
      correo: "gestor-rt-3@correo.com",
      telefono: "+59172222223",
      codigo: "CB-RT-3",
      estatus: "activo",
    });

    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${tokenPropietario}`)
      .send({
        nombre: "Cartera Gestor Ajeno",
        propietarioId,
        gestorId: gestorAjeno.id,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(403);
    await gestorRepo.delete({ id: gestorAjeno.id });
  });

  it("POST /carteras con gestor bloqueado -> 409", async () => {
    await request(app.getHttpServer())
      .patch(`/gestores/${gestorId}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "bloqueado" });

    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera Bloqueada",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });

    expect(res.status).toBe(409);
  });

  it("la cascada bloquea las carteras del gestor y las reactiva al reactivarlo", async () => {
    const creada = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera Cascada",
        propietarioId,
        gestorId: gestor2Id,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    const cascadaCarteraId = creada.body.id as number;

    await request(app.getHttpServer())
      .patch(`/gestores/${gestor2Id}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "bloqueado" });

    let fila = await carteraRepo.findOne({ where: { id: cascadaCarteraId } });
    expect(fila?.estatus).toBe("bloqueado");

    await request(app.getHttpServer())
      .patch(`/gestores/${gestor2Id}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "activo" });

    fila = await carteraRepo.findOne({ where: { id: cascadaCarteraId } });
    expect(fila?.estatus).toBe("activo");
  });

  it("PATCH /carteras/:id/estatus reactiva manualmente", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/estatus`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estatus: "bloqueado" });

    expect(res.status).toBe(200);
    expect(res.body.estatus).toBe("bloqueado");
  });

  it("PATCH /carteras/:id/gestor reasigna la cartera", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/gestor`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ gestorId: gestor2Id });

    expect(res.status).toBe(200);
    expect(res.body.gestorId).toBe(gestor2Id);
    expect(res.body.estatus).toBe("activo");
  });

  it("PATCH /carteras/:id/gestor de un gestor ajeno -> 409", async () => {
    const gestorAjeno = await gestorRepo.save({
      propietario: { id: otroPropietarioId },
      usuario: "gestor-rt-4",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Lina",
      apellido: "Peña",
      correo: "gestor-rt-4@correo.com",
      telefono: "+59172222224",
      codigo: "CB-RT-4",
      estatus: "activo",
    });

    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/gestor`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ gestorId: gestorAjeno.id });

    expect(res.status).toBe(409);
    await gestorRepo.delete({ id: gestorAjeno.id });
  });

  it("POST /carteras con datos inválidos -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera Inválida",
        propietarioId,
        gestorId,
        tipoInteres: 0,
        numCuotas: 0,
        moneda: "peso",
      });

    expect(res.status).toBe(400);
  });

  it("POST /carteras sin saldoInicial -> 400 (obligatorio, HU-08)", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera Sin Saldo",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
      });

    expect(res.status).toBe(400);
  });

  it("POST /carteras con saldoInicial negativo -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera Saldo Negativo",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: -50,
      });

    expect(res.status).toBe(400);
  });

  it("POST /carteras sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/carteras")
      .send({
        nombre: "Cartera X",
        propietarioId,
        gestorId,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
      });

    expect(res.status).toBe(401);
  });


  describe("GET /carteras (listado)", () => {
    let carteraBloqueadaId: number;

    beforeAll(async () => {
      // El test de cascada previo deja CB-RT-1 bloqueado; se reactiva para
      // poder crear una cartera con él en este bloque.
      await request(app.getHttpServer())
        .patch(`/gestores/${gestorId}/estatus`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ estatus: "activo" });

      // Desacopla el filtro por estatus del orden de los tests: garantiza que
      // "Cartera E2E" esté activa al ejecutar este bloque (el test de reasignación
      // previo también la deja activa, pero no debe depender de eso).
      await request(app.getHttpServer())
        .patch(`/carteras/${carteraId}/estatus`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ estatus: "activo" });

      const creada = await request(app.getHttpServer())
        .post("/carteras")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({
          nombre: "Cartera Bloqueada",
          propietarioId,
          gestorId,
          tipoInteres: 20,
          numCuotas: 8,
          moneda: "BOB",
          saldoInicial: 500,
          costoCobro: 200,
        });
      carteraBloqueadaId = creada.body.id as number;
      await request(app.getHttpServer())
        .patch(`/carteras/${carteraBloqueadaId}/estatus`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ estatus: "bloqueado" });
    });

    afterAll(async () => {
      await carteraRepo.delete({ id: carteraBloqueadaId });
    });

    it("devuelve todas las carteras como admin", async () => {
      const res = await request(app.getHttpServer())
        .get("/carteras")
        .set("Authorization", `Bearer ${accessTokenAdmin}`);

      expect(res.status).toBe(200);
      const nombres = res.body.map((r: { nombre: string }) => r.nombre);
      expect(nombres).toContain("Cartera E2E");
      expect(nombres).toContain("Cartera Bloqueada");
    });

    it("filtra por busqueda (ILIKE)", async () => {
      const res = await request(app.getHttpServer())
        .get("/carteras")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ busqueda: "Cartera E2E" });

      expect(res.status).toBe(200);
      const nombres = res.body.map((r: { nombre: string }) => r.nombre);
      expect(nombres).toContain("Cartera E2E");
      expect(nombres).not.toContain("Cartera Bloqueada");
    });

    it("filtra por estatus", async () => {
      const res = await request(app.getHttpServer())
        .get("/carteras")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ estatus: "bloqueado" });

      expect(res.status).toBe(200);
      const nombres = res.body.map((r: { nombre: string }) => r.nombre);
      expect(nombres).toContain("Cartera Bloqueada");
      expect(nombres).not.toContain("Cartera E2E");
    });

    it("rechaza un estatus inválido con 400", async () => {
      const res = await request(app.getHttpServer())
        .get("/carteras")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ estatus: "pendiente" });

      expect(res.status).toBe(400);
    });

    it("responde 401 sin token", async () => {
      const res = await request(app.getHttpServer()).get("/carteras");
      expect(res.status).toBe(401);
    });

    it("un propietario ve solo sus carteras (ownership)", async () => {
      const login = await request(app.getHttpServer())
        .post("/auth/propietario/login")
        .send({ usuario: "propietario-rt-1", password: "password-seguro" });
      const tokenPropietario = login.body.accessToken as string;

      const res = await request(app.getHttpServer())
        .get("/carteras")
        .set("Authorization", `Bearer ${tokenPropietario}`);

      expect(res.status).toBe(200);
      const carteras = res.body as { propietarioId: number }[];
      expect(carteras.length).toBeGreaterThan(0);
      expect(carteras.every((r) => r.propietarioId === propietarioId)).toBe(true);
    });
  });

  it("GET /carteras/posiciones como admin -> 200 con array", async () => {
    const res = await request(app.getHttpServer())
      .get("/carteras/posiciones")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
