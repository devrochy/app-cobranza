import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { PromesaPago } from "../../src/modules/cartera/promesa-pago.entity";
import { AuditoriaCartera } from "../../src/modules/cartera/auditoria-cartera.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Promesas/acuerdos como entidades auditables (e2e, HU-34)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let promesaRepo: Repository<PromesaPago>;
  let auditoriaRepo: Repository<AuditoriaCartera>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let prestamoId: number;
  let promesaId: number;

  const ADMIN_USERNAME = "promaud-e2e-admin";
  const ADMIN_PASSWORD = "Admin#PromAud2026";
  const PASSWORD = "Socio#PromAud2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-promaud";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-promaud";
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
    promesaRepo = moduleFixture.get(getRepositoryToken(PromesaPago));
    auditoriaRepo = moduleFixture.get(getRepositoryToken(AuditoriaCartera));

    await promesaRepo.createQueryBuilder().delete().execute();
    await auditoriaRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta PROMAUD'))").execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta PROMAUD')").execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id IN (SELECT id FROM rutas WHERE nombre = 'Ruta PROMAUD')").execute();
    await rutaRepo.delete({ nombre: "Ruta PROMAUD" });
    await cobradorRepo.delete({ codigo: "CB-PROMAUD-1" });
    await socioRepo.delete({ codigo: "SC-PROMAUD-1" });
    await socioRepo.delete({ codigo: "SC-PROMAUD-2" });
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
      usuario: "socio-promaud-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-promaud-1@correo.com",
      telefono: "+59171160150",
      codigo: "SC-PROMAUD-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-promaud-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-promaud-1@correo.com",
      telefono: "+59172270150",
      codigo: "CB-PROMAUD-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta PROMAUD",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "PromAud",
        apellido: "Cliente",
        negocio: "N",
        telefonoWhatsapp: "+59171160151",
        latitud: -17.78,
        longitud: -63.18,
      });
    const clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId, valor: 400, numCuotas: 2, diasEntreCuotas: 7 });
    prestamoId = prestamoRes.body.id as number;

    const promesa = await promesaRepo.save({
      prestamo: { id: prestamoId } as PromesaPago["prestamo"],
      prestamoId,
      fechaPrometida: "2099-01-01",
      valorPrometido: 240,
      estado: "pendiente",
      creadoPor: "ia",
      tipo: "promesa",
    });
    promesaId = promesa.id;
  });

  afterAll(async () => {
    await promesaRepo.createQueryBuilder().delete().execute();
    await auditoriaRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id = :rutaId)", { rutaId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-PROMAUD-1" });
    await socioRepo.delete({ codigo: "SC-PROMAUD-1" });
    await socioRepo.delete({ codigo: "SC-PROMAUD-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET .../prestamos/:prestamoId/promesas devuelve el historial del préstamo", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/prestamos/${prestamoId}/promesas`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: { id: number }) => p.id === promesaId)).toBe(true);
    const promesa = res.body.find((p: { id: number }) => p.id === promesaId);
    expect(promesa).toMatchObject({
      prestamoId,
      estado: "pendiente",
      creadoPor: "ia",
      tipo: "promesa",
    });
  });

  it("GET .../promesas sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/prestamos/${prestamoId}/promesas`);

    expect(res.status).toBe(401);
  });

  it("PATCH .../promesas/:promesaId/estado transiciona y registra la auditoría", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/promesas/${promesaId}/estado`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estado: "cumplida", motivo: "el cliente pagó su cuota" });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("cumplida");

    const auditoria = await auditoriaRepo.findOne({
      where: { entidad: "promesa", entidadId: promesaId },
      order: { id: "DESC" },
    });
    expect(auditoria).toBeDefined();
    expect(auditoria?.operacion).toBe("editar");
    expect(auditoria?.valoresAntes).toEqual({ estado: "pendiente" });
    expect(auditoria?.valoresDespues).toEqual({ estado: "cumplida" });
    expect(auditoria?.actorRol).toBe("admin");
  });

  it("PATCH .../estado con motivo vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/promesas/${promesaId}/estado`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estado: "incumplida", motivo: "" });

    expect(res.status).toBe(400);
  });

  it("PATCH .../estado con estado inválido -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/promesas/${promesaId}/estado`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ estado: "pagada", motivo: "prueba" });

    expect(res.status).toBe(400);
  });

  it("un socio sin generar_reporte no puede transicionar -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-promaud-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-promaud-2@correo.com",
      telefono: "+59171160152",
      codigo: "SC-PROMAUD-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-promaud-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/promesas/${promesaId}/estado`)
      .set("Authorization", `Bearer ${tokenSocio}`)
      .send({ estado: "incumplida", motivo: "prueba" });

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});