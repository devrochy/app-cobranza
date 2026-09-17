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

describe("Lista de clientes del día (e2e)", () => {
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

  const ADMIN_USERNAME = "ldia-e2e-admin";
  const ADMIN_PASSWORD = "Admin#LDia2026";
  const PASSWORD = "Propietario#LDia2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-ldia";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-ldia";
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
    await gestorRepo.delete({ codigo: "CB-LDIA-1" });
    await propietarioRepo.delete({ codigo: "SC-LDIA-1" });
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
      usuario: "propietario-ldia-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-ldia-1@correo.com",
      telefono: "+59171160100",
      codigo: "SC-LDIA-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-ldia-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-ldia-1@correo.com",
      telefono: "+59172270100",
      codigo: "CB-LDIA-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera LDIA",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    // Cliente 1 con deuda.
    const c1 = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "ConDeuda",
        apellido: "Ldia",
        negocio: "N1",
        telefonoWhatsapp: "+59171160101",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
    const c1Id = c1.body.id as number;
    const prestamoConDeuda = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: c1Id, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
    // La cuota debe vencer HOY para que el cliente aparezca en la lista del día.
    const hoy = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    await cuotaRepo
      .createQueryBuilder()
      .update()
      .set({ fechaVencimiento: hoy })
      .where("prestamo_id = :pid", { pid: prestamoConDeuda.body.id })
      .execute();

    // Cliente 2 sin deuda (al día).
    await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "SinDeuda",
        apellido: "Ldia",
        negocio: "N2",
        telefonoWhatsapp: "+59171160102",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.79,
        longitud: -63.19,
      });

    // Cliente 4 con préstamo VIGENTE pero cuota FUTURA (no vence hoy): no debe
    // aparecer en la lista del día.
    const cFuturo = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Futuro",
        apellido: "Ldia",
        negocio: "N4",
        telefonoWhatsapp: "+59171160105",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.81,
        longitud: -63.21,
      });
    const cFuturoId = cFuturo.body.id as number;
    await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: cFuturoId, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });

    // Cliente 3 con préstamo liquidado (sin deuda vigente → esNuevo/blanco).
    const c3 = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Liquidado",
        apellido: "Ldia",
        negocio: "N3",
        telefonoWhatsapp: "+59171160104",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.8,
        longitud: -63.2,
      });
    const c3Id = c3.body.id as number;
    const prestamoLiquidado = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: c3Id, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
    await prestamoRepo.update(prestamoLiquidado.body.id, { estatus: "liquidado" });
  });

  afterAll(async () => {
    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id = :carteraId)", { carteraId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-LDIA-1" });
    await propietarioRepo.delete({ codigo: "SC-LDIA-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /carteras/:id/trayecto-diario/clientes solo incluye clientes con cuota de hoy, mora o compromiso", async () => {
    // Generar trayectos para que el cliente con deuda quede en trayecto.
    await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/trayecto-diario/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/trayecto-diario/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const conDeuda = res.body.find((c: { clienteId: number; nombre: string }) =>
      c.nombre.includes("ConDeuda"),
    );
    const sinDeuda = res.body.find((c: { clienteId: number; nombre: string }) =>
      c.nombre.includes("SinDeuda"),
    );
    const liquidado = res.body.find((c: { clienteId: number; nombre: string }) =>
      c.nombre.includes("Liquidado"),
    );
    const futuro = res.body.find((c: { clienteId: number; nombre: string }) =>
      c.nombre.includes("Futuro"),
    );

    // Aparece el cliente con préstamo vigente y cuota que vence HOY.
    expect(conDeuda).toBeDefined();
    expect(conDeuda.enTrayecto).toBe(true);
    expect(["verde", "rojo", "blanco"]).toContain(conDeuda.color);
    expect(typeof conDeuda.diasMora).toBe("number");

    // Sin préstamos, liquidado o con cuota futura NO deben estar en la lista.
    expect(sinDeuda).toBeUndefined();
    expect(liquidado).toBeUndefined();
    expect(futuro).toBeUndefined();
  });

  it("GET /carteras/:id/trayecto-diario/clientes con cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/999999/trayecto-diario/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /carteras/:id/trayecto-diario/clientes sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/carteras/${carteraId}/trayecto-diario/clientes`);

    expect(res.status).toBe(401);
  });

  it("un propietario SIN ver_reportes no puede ver la lista -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-ldia-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-ldia-2@correo.com",
      telefono: "+59171160103",
      codigo: "SC-LDIA-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-ldia-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/trayecto-diario/clientes`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});