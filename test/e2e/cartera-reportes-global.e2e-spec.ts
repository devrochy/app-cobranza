import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { In, Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Liquidacion } from "../../src/modules/carteras/liquidacion.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Cartera y reportes globales (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let liquidacionRepo: Repository<Liquidacion>;
  let clienteRepo: Repository<Cliente>;
  let accessTokenAdmin: string;
  let tokenPropietario1: string;
  let tokenPropietario2: string;
  let carteraPropietario1: number;
  let carteraPropietario2: number;

  const ADMIN_USERNAME = "global-e2e-admin";
  const ADMIN_PASSWORD = "global-e2e-password";
  const PASSWORD = "password-seguro";

  beforeAll(async () => {
    process.env.JWT_SECRET = "global-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "global-e2e-refresh-secret";
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
    liquidacionRepo = moduleFixture.get(getRepositoryToken(Liquidacion));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));

    const limpiarCarteras = async (nombres: string[]) => {
      const carteras = await carteraRepo.find({ where: nombres.map((n) => ({ nombre: n })) });
      const ids = carteras.map((r) => r.id);
      if (ids.length) {
        await clienteRepo.delete({ cartera: { id: In(ids) } });
        await liquidacionRepo.delete({ cartera: { id: In(ids) } });
      }
      await carteraRepo.delete({ nombre: In(nombres) });
    };
    await limpiarCarteras(["Cartera Global 1", "Cartera Global 2"]);
    await gestorRepo.delete({ codigo: In(["CB-GLOBAL-1", "CB-GLOBAL-2"]) });
    await propietarioRepo.delete({ codigo: In(["SC-GLOBAL-1", "SC-GLOBAL-2"]) });

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

    const propietario1 = await propietarioRepo.save({
      usuario: "propietario-global-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S1",
      apellido: "E2E",
      correo: "propietario-global-1@correo.com",
      telefono: "+59170001001",
      codigo: "SC-GLOBAL-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const propietario2 = await propietarioRepo.save({
      usuario: "propietario-global-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-global-2@correo.com",
      telefono: "+59170001002",
      codigo: "SC-GLOBAL-2",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor1 = await gestorRepo.save({
      propietario: { id: propietario1.id },
      usuario: "gestor-global-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C1",
      apellido: "E2E",
      correo: "gestor-global-1@correo.com",
      telefono: "+59170001003",
      codigo: "CB-GLOBAL-1",
      estatus: "activo",
    });
    const gestor2 = await gestorRepo.save({
      propietario: { id: propietario2.id },
      usuario: "gestor-global-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C2",
      apellido: "E2E",
      correo: "gestor-global-2@correo.com",
      telefono: "+59170001004",
      codigo: "CB-GLOBAL-2",
      estatus: "activo",
    });

    const crearCartera = (nombre: string, propietarioId: number, gestorId: number) =>
      request(app.getHttpServer())
        .post("/carteras")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({
          nombre,
          propietarioId,
          gestorId,
          tipoInteres: 20,
          numCuotas: 4,
          moneda: "BOB",
          saldoInicial: 1000,
          costoCobro: 250,
        });

    await request(app.getHttpServer())
      .put(`/propietarios/${propietario1.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_cartera: true, ver_reportes: true } });
    await request(app.getHttpServer())
      .put(`/propietarios/${propietario2.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_cartera: true, ver_reportes: true } });

    const cartera1 = await crearCartera("Cartera Global 1", propietario1.id, gestor1.id);
    const cartera2 = await crearCartera("Cartera Global 2", propietario2.id, gestor2.id);
    carteraPropietario1 = cartera1.body.id as number;
    carteraPropietario2 = cartera2.body.id as number;

    const crearCliente = (carteraId: number, nombre: string) =>
      request(app.getHttpServer())
        .post(`/carteras/${carteraId}/clientes`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .field("nombre", nombre)
        .field("apellido", "E2E")
        .field("telefonoWhatsapp", "+59170002001")
        .field("tipoDocumento", "ci")
        .field("numeroDocumento", "1234567")
        .field("latitud", "-17.78")
        .field("longitud", "-63.18");

    await crearCliente(carteraPropietario1, "ClienteGlobal1");
    await crearCliente(carteraPropietario2, "ClienteGlobal2");

    await liquidacionRepo.save({
      cartera: { id: carteraPropietario1 },
      carteraId: carteraPropietario1,
      fecha: "2026-08-31",
      periodo: "diario",
      cajaAnterior: 1000,
      cajaActual: 1200,
      estimadoACobrar: 2000,
      totalInyeccion: 0,
      totalCobradoPeriodo: 200,
      totalCobradoDia: 200,
      totalPrestado: 0,
      totalGastos: 0,
      sumaCartera: 1000,
      comisionPorcentaje: 10,
      comisionValor: 20,
      comentario: "liquidacion-e2e",
    } as Partial<Liquidacion>);

    const login1 = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-global-1", password: PASSWORD });
    tokenPropietario1 = login1.body.accessToken as string;

    const login2 = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-global-2", password: PASSWORD });
    tokenPropietario2 = login2.body.accessToken as string;
  });

  afterAll(async () => {
    const ids = [carteraPropietario1, carteraPropietario2].filter((id): id is number => Number.isFinite(id));
    if (ids.length) {
      await clienteRepo.delete({ cartera: { id: In(ids) } });
      await liquidacionRepo.delete({ cartera: { id: In(ids) } });
    }
    await carteraRepo.delete({ id: In(ids.length ? ids : [0]) });
    await gestorRepo.delete({ codigo: In(["CB-GLOBAL-1", "CB-GLOBAL-2"]) });
    await propietarioRepo.delete({ codigo: In(["SC-GLOBAL-1", "SC-GLOBAL-2"]) });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /clientes como admin ve clientes de todas las carteras con carteraNombre", async () => {
    const res = await request(app.getHttpServer())
      .get("/clientes")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const nombres = (res.body.items as { nombre: string; carteraNombre: string }[]).map((c) => c.nombre);
    expect(nombres).toContain("ClienteGlobal1");
    expect(nombres).toContain("ClienteGlobal2");
    expect(res.body.items.some((c: { carteraNombre: string }) => c.carteraNombre === "Cartera Global 1")).toBe(true);
  });

  it("GET /clientes como propietario solo ve clientes de sus carteras", async () => {
    const res = await request(app.getHttpServer())
      .get("/clientes")
      .set("Authorization", `Bearer ${tokenPropietario1}`);

    expect(res.status).toBe(200);
    const nombres = (res.body.items as { nombre: string }[]).map((c) => c.nombre);
    expect(nombres).toEqual(["ClienteGlobal1"]);
  });

  it("GET /reportes/liquidaciones como admin ve las liquidaciones globales", async () => {
    const res = await request(app.getHttpServer())
      .get("/reportes/liquidaciones")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const conMia = (res.body as { comentario: string; carteraNombre: string }[]).some(
      (l) => l.comentario === "liquidacion-e2e" && l.carteraNombre === "Cartera Global 1",
    );
    expect(conMia).toBe(true);
  });

  it("GET /reportes/liquidaciones de un propietario solo trae las de sus carteras", async () => {
    const res = await request(app.getHttpServer())
      .get("/reportes/liquidaciones")
      .set("Authorization", `Bearer ${tokenPropietario2}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});