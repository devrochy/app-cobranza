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

describe("Segmentación de trayectos de la cartera del día (e2e)", () => {
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

  const ADMIN_USERNAME = "tray-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Tray2026";
  const PASSWORD = "Propietario#Tray2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-tray";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-tray";
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
    await gestorRepo.delete({ codigo: "CB-TRAY-1" });
    await propietarioRepo.delete({ codigo: "SC-TRAY-1" });
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
      usuario: "propietario-tray-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-tray-1@correo.com",
      telefono: "+59171160088",
      codigo: "SC-TRAY-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-tray-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-tray-1@correo.com",
      telefono: "+59172270088",
      codigo: "CB-TRAY-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera TRAY",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    // 3 clientes cercanos con préstamo (deuda pendiente).
    const prestamoIds: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const clienteRes = await request(app.getHttpServer())
        .post(`/carteras/${carteraId}/clientes`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({
          nombre: `Cliente${i}`,
          apellido: "Tray",
          negocio: `Negocio${i}`,
          telefonoWhatsapp: `+5917116009${i}`,
          tipoDocumento: "ci",
          numeroDocumento: "1234567",
          latitud: -17.78 + i * 0.002,
          longitud: -63.18 + i * 0.002,
        });
      const clienteId = clienteRes.body.id as number;
      const prestamoRes = await request(app.getHttpServer())
        .post(`/carteras/${carteraId}/prestamos`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ clienteId, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
      prestamoIds.push(prestamoRes.body.id as number);
    }

    // La regla de "cobro HOY" exige cuotas que vencen HOY (o mora / promesa HOY);
    // el fixture forzará el vencimiento de HOY, igual que mapa-clientes-dia.e2e-spec.
    const hoy = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    await cuotaRepo
      .createQueryBuilder()
      .update()
      .set({ fechaVencimiento: hoy })
      .where("prestamo_id IN (:...ids)", { ids: prestamoIds })
      .execute();

    // 1 cliente sin deuda (sin préstamo): NO debe aparecer en los trayectos del día.
    await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "SinDeuda",
        apellido: "Tray",
        negocio: "SinDeuda",
        telefonoWhatsapp: "+59171160094",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
  });

  afterAll(async () => {
    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id = :carteraId)", { carteraId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-TRAY-1" });
    await propietarioRepo.delete({ codigo: "SC-TRAY-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /carteras/:id/trayecto-diario/trayectos segmenta y persiste los trayectos", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/trayecto-diario/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const ids = res.body.flat().map((p: { clienteId: number }) => p.clienteId);
    // Solo los 3 clientes con deuda; el cliente sin préstamo NO se incluye.
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain(undefined);

    const enDb = await logRepo.findOne({ where: { cartera: { id: carteraId }, tipo: "planificada" } });
    expect(enDb).toBeDefined();
    expect(enDb?.recalculado).toBe(false);
  });

  it("GET /carteras/:id/trayecto-diario/trayectos consulta el trayecto planificado del día", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/trayecto-diario/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.tipo).toBe("planificada");
    expect(res.body.distanciaEstimadaKm).toBeGreaterThanOrEqual(0);
  });

  it("GET /carteras/:id/trayecto-diario/trayectos con cartera inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/999999/trayecto-diario/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("POST /carteras/:id/trayecto-diario/trayectos sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).post(`/carteras/${carteraId}/trayecto-diario/trayectos`);

    expect(res.status).toBe(401);
  });

  it("un propietario SIN generar_reporte no puede generar trayectos -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-tray-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-tray-2@correo.com",
      telefono: "+59171160090",
      codigo: "SC-TRAY-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-tray-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/trayecto-diario/trayectos`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});