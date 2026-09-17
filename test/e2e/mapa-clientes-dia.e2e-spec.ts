import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { CarteraOptimizadaLog } from "../../src/modules/carteras/cartera-optimizada-log.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Mapa de clientes del día (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let logRepo: Repository<CarteraOptimizadaLog>;
  let accessTokenAdmin: string;
  let carteraId: number;

  const ADMIN_USERNAME = "mapa-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Mapa2026";
  const PASSWORD = "Propietario#Mapa2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-mapa";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-mapa";
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
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));
    logRepo = moduleFixture.get(getRepositoryToken(CarteraOptimizadaLog));

    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-MAPA-1" });
    await propietarioRepo.delete({ codigo: "SC-MAPA-1" });
    await propietarioRepo.delete({ codigo: "SC-MAPA-2" });
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
      usuario: "propietario-mapa-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-mapa-1@correo.com",
      telefono: "+59171160110",
      codigo: "SC-MAPA-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-mapa-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-mapa-1@correo.com",
      telefono: "+59172270110",
      codigo: "CB-MAPA-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera MAPA",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    // Cliente con domicilio y deuda.
    const c1 = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "ConDomicilio",
        apellido: "Mapa",
        negocio: "N1",
        telefonoWhatsapp: "+59171160111",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
        latitudDomicilio: -17.79,
        longitudDomicilio: -63.19,
      });
    const c1Id = c1.body.id as number;
    const prestamoC1 = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: c1Id, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });

    // Cliente sin domicilio (solo negocio).
    const c2 = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "SinDomicilio",
        apellido: "Mapa",
        negocio: "N2",
        telefonoWhatsapp: "+59171160112",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.8,
        longitud: -63.2,
      });
    const c2Id = c2.body.id as number;
    const prestamoC2 = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: c2Id, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });

    // Las cuotas deben vencer HOY para que los clientes aparezcan en el mapa del día.
    const hoy = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    await cuotaRepo
      .createQueryBuilder()
      .update()
      .set({ fechaVencimiento: hoy })
      .where("prestamo_id IN (:...ids)", { ids: [prestamoC1.body.id, prestamoC2.body.id] })
      .execute();
  });

  afterAll(async () => {
    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id = :carteraId)", { carteraId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-MAPA-1" });
    await propietarioRepo.delete({ codigo: "SC-MAPA-1" });
    await propietarioRepo.delete({ codigo: "SC-MAPA-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /carteras/:id/trayecto-diario/mapa devuelve markers de negocio y domicilio", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/trayecto-diario/mapa`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // El cliente con domicilio genera marker de negocio Y de domicilio.
    const markersConDomicilio = res.body.filter(
      (m: { clienteId: number; nombre: string }) => m.nombre.includes("ConDomicilio"),
    );
    expect(markersConDomicilio.some((m: { tipo: string }) => m.tipo === "negocio")).toBe(true);
    expect(markersConDomicilio.some((m: { tipo: string }) => m.tipo === "domicilio")).toBe(true);

    // El cliente sin domicilio solo genera marker de negocio.
    const markersSinDomicilio = res.body.filter(
      (m: { nombre: string }) => m.nombre.includes("SinDomicilio"),
    );
    expect(markersSinDomicilio).toHaveLength(1);
    expect(markersSinDomicilio[0].tipo).toBe("negocio");
  });

  it("GET /carteras/:id/trayecto-diario/mapa con cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/999999/trayecto-diario/mapa`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /carteras/:id/trayecto-diario/mapa sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraId}/trayecto-diario/mapa`);

    expect(res.status).toBe(401);
  });

  it("un propietario SIN ver_reportes no puede ver el mapa -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-mapa-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-mapa-2@correo.com",
      telefono: "+59171160113",
      codigo: "SC-MAPA-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-mapa-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/trayecto-diario/mapa`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});