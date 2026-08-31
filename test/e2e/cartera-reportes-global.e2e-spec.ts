import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { In, Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Liquidacion } from "../../src/modules/rutas/liquidacion.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Cartera y reportes globales (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let liquidacionRepo: Repository<Liquidacion>;
  let clienteRepo: Repository<Cliente>;
  let accessTokenAdmin: string;
  let tokenSocio1: string;
  let tokenSocio2: string;
  let rutaSocio1: number;
  let rutaSocio2: number;

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    liquidacionRepo = moduleFixture.get(getRepositoryToken(Liquidacion));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));

    const limpiarRutas = async (nombres: string[]) => {
      const rutas = await rutaRepo.find({ where: nombres.map((n) => ({ nombre: n })) });
      const ids = rutas.map((r) => r.id);
      if (ids.length) {
        await clienteRepo.delete({ ruta: { id: In(ids) } });
        await liquidacionRepo.delete({ ruta: { id: In(ids) } });
      }
      await rutaRepo.delete({ nombre: In(nombres) });
    };
    await limpiarRutas(["Ruta Global 1", "Ruta Global 2"]);
    await cobradorRepo.delete({ codigo: In(["CB-GLOBAL-1", "CB-GLOBAL-2"]) });
    await socioRepo.delete({ codigo: In(["SC-GLOBAL-1", "SC-GLOBAL-2"]) });

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

    const socio1 = await socioRepo.save({
      usuario: "socio-global-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S1",
      apellido: "E2E",
      correo: "socio-global-1@correo.com",
      telefono: "+59170001001",
      codigo: "SC-GLOBAL-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const socio2 = await socioRepo.save({
      usuario: "socio-global-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-global-2@correo.com",
      telefono: "+59170001002",
      codigo: "SC-GLOBAL-2",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador1 = await cobradorRepo.save({
      socio: { id: socio1.id },
      usuario: "cobrador-global-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C1",
      apellido: "E2E",
      correo: "cobrador-global-1@correo.com",
      telefono: "+59170001003",
      codigo: "CB-GLOBAL-1",
      estatus: "activo",
    });
    const cobrador2 = await cobradorRepo.save({
      socio: { id: socio2.id },
      usuario: "cobrador-global-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C2",
      apellido: "E2E",
      correo: "cobrador-global-2@correo.com",
      telefono: "+59170001004",
      codigo: "CB-GLOBAL-2",
      estatus: "activo",
    });

    const crearRuta = (nombre: string, socioId: number, cobradorId: number) =>
      request(app.getHttpServer())
        .post("/rutas")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({
          nombre,
          socioId,
          cobradorId,
          tipoInteres: 20,
          numCuotas: 4,
          moneda: "BOB",
          saldoInicial: 1000,
          costoCobro: 250,
        });

    await request(app.getHttpServer())
      .put(`/socios/${socio1.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_ruta: true, ver_reportes: true } });
    await request(app.getHttpServer())
      .put(`/socios/${socio2.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_ruta: true, ver_reportes: true } });

    const ruta1 = await crearRuta("Ruta Global 1", socio1.id, cobrador1.id);
    const ruta2 = await crearRuta("Ruta Global 2", socio2.id, cobrador2.id);
    rutaSocio1 = ruta1.body.id as number;
    rutaSocio2 = ruta2.body.id as number;

    const crearCliente = (rutaId: number, nombre: string) =>
      request(app.getHttpServer())
        .post(`/rutas/${rutaId}/clientes`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .field("nombre", nombre)
        .field("apellido", "E2E")
        .field("telefonoWhatsapp", "+59170002001")
        .field("latitud", "-17.78")
        .field("longitud", "-63.18");

    await crearCliente(rutaSocio1, "ClienteGlobal1");
    await crearCliente(rutaSocio2, "ClienteGlobal2");

    await liquidacionRepo.save({
      ruta: { id: rutaSocio1 },
      rutaId: rutaSocio1,
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
      .post("/auth/socio/login")
      .send({ usuario: "socio-global-1", password: PASSWORD });
    tokenSocio1 = login1.body.accessToken as string;

    const login2 = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-global-2", password: PASSWORD });
    tokenSocio2 = login2.body.accessToken as string;
  });

  afterAll(async () => {
    const ids = [rutaSocio1, rutaSocio2].filter((id): id is number => Number.isFinite(id));
    if (ids.length) {
      await clienteRepo.delete({ ruta: { id: In(ids) } });
      await liquidacionRepo.delete({ ruta: { id: In(ids) } });
    }
    await rutaRepo.delete({ id: In(ids.length ? ids : [0]) });
    await cobradorRepo.delete({ codigo: In(["CB-GLOBAL-1", "CB-GLOBAL-2"]) });
    await socioRepo.delete({ codigo: In(["SC-GLOBAL-1", "SC-GLOBAL-2"]) });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /cartera/clientes como admin ve clientes de todas las rutas con rutaNombre", async () => {
    const res = await request(app.getHttpServer())
      .get("/cartera/clientes")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const nombres = (res.body as { nombre: string; rutaNombre: string }[]).map((c) => c.nombre);
    expect(nombres).toContain("ClienteGlobal1");
    expect(nombres).toContain("ClienteGlobal2");
    expect(res.body.some((c: { rutaNombre: string }) => c.rutaNombre === "Ruta Global 1")).toBe(true);
  });

  it("GET /cartera/clientes como socio solo ve clientes de sus rutas", async () => {
    const res = await request(app.getHttpServer())
      .get("/cartera/clientes")
      .set("Authorization", `Bearer ${tokenSocio1}`);

    expect(res.status).toBe(200);
    const nombres = (res.body as { nombre: string }[]).map((c) => c.nombre);
    expect(nombres).toEqual(["ClienteGlobal1"]);
  });

  it("GET /reportes/liquidaciones como admin ve las liquidaciones globales", async () => {
    const res = await request(app.getHttpServer())
      .get("/reportes/liquidaciones")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const conMia = (res.body as { comentario: string; rutaNombre: string }[]).some(
      (l) => l.comentario === "liquidacion-e2e" && l.rutaNombre === "Ruta Global 1",
    );
    expect(conMia).toBe(true);
  });

  it("GET /reportes/liquidaciones de un socio solo trae las de sus rutas", async () => {
    const res = await request(app.getHttpServer())
      .get("/reportes/liquidaciones")
      .set("Authorization", `Bearer ${tokenSocio2}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});