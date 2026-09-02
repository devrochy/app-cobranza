import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { RutaOptimizadaLog } from "../../src/modules/rutas/ruta-optimizada-log.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Lista de clientes del día (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let logRepo: Repository<RutaOptimizadaLog>;
  let accessTokenAdmin: string;
  let rutaId: number;

  const ADMIN_USERNAME = "ldia-e2e-admin";
  const ADMIN_PASSWORD = "Admin#LDia2026";
  const PASSWORD = "Socio#LDia2026";

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));
    logRepo = moduleFixture.get(getRepositoryToken(RutaOptimizadaLog));

    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-LDIA-1" });
    await socioRepo.delete({ codigo: "SC-LDIA-1" });
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
      usuario: "socio-ldia-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-ldia-1@correo.com",
      telefono: "+59171160100",
      codigo: "SC-LDIA-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-ldia-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-ldia-1@correo.com",
      telefono: "+59172270100",
      codigo: "CB-LDIA-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta LDIA",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;

    // Cliente 1 con deuda.
    const c1 = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "ConDeuda",
        apellido: "Ldia",
        negocio: "N1",
        telefonoWhatsapp: "+59171160101",
        latitud: -17.78,
        longitud: -63.18,
      });
    const c1Id = c1.body.id as number;
    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: c1Id, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });

    // Cliente 2 sin deuda (al día).
    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "SinDeuda",
        apellido: "Ldia",
        negocio: "N2",
        telefonoWhatsapp: "+59171160102",
        latitud: -17.79,
        longitud: -63.19,
      });

    // Cliente 3 con préstamo liquidado (sin deuda vigente → esNuevo/blanco).
    const c3 = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Liquidado",
        apellido: "Ldia",
        negocio: "N3",
        telefonoWhatsapp: "+59171160104",
        latitud: -17.8,
        longitud: -63.2,
      });
    const c3Id = c3.body.id as number;
    const prestamoLiquidado = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId: c3Id, valor: 1000, numCuotas: 4, diasEntreCuotas: 7 });
    await prestamoRepo.update(prestamoLiquidado.body.id, { estatus: "liquidado" });
  });

  afterAll(async () => {
    await logRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id = :rutaId)", { rutaId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-LDIA-1" });
    await socioRepo.delete({ codigo: "SC-LDIA-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /rutas/:id/dia/clientes solo incluye clientes con préstamo vigente", async () => {
    // Generar trayectos para que el cliente con deuda quede en trayecto.
    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/dia/trayectos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/dia/clientes`)
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

    // Solo el cliente con préstamo VIGENTE aparece en la lista del día.
    expect(conDeuda).toBeDefined();
    expect(conDeuda.enTrayecto).toBe(true);
    expect(["verde", "rojo", "blanco"]).toContain(conDeuda.color);

    // Cliente sin préstamos y con préstamo liquidado NO deben estar en la lista.
    expect(sinDeuda).toBeUndefined();
    expect(liquidado).toBeUndefined();
  });

  it("GET /rutas/:id/dia/clientes con ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/999999/dia/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET /rutas/:id/dia/clientes sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(`/rutas/${rutaId}/dia/clientes`);

    expect(res.status).toBe(401);
  });

  it("un socio SIN ver_reportes no puede ver la lista -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-ldia-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-ldia-2@correo.com",
      telefono: "+59171160103",
      codigo: "SC-LDIA-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-ldia-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/dia/clientes`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});