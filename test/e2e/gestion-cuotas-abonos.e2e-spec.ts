import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Abono } from "../../src/modules/cartera/abono.entity";
import { AuditoriaCartera } from "../../src/modules/cartera/auditoria-cartera.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Pago } from "../../src/modules/cartera/pago.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Caja } from "../../src/modules/rutas/caja.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Gestión de cuotas y abonos con auditoría (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let abonoRepo: Repository<Abono>;
  let auditoriaRepo: Repository<AuditoriaCartera>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;
  let prestamoId: number;

  const ADMIN_USERNAME = "cuotas-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Cuotas2026";
  const PASSWORD = "Socio#Cuotas2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-cuotas";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-cuotas";
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
    pagoRepo = moduleFixture.get(getRepositoryToken(Pago));
    abonoRepo = moduleFixture.get(getRepositoryToken(Abono));
    auditoriaRepo = moduleFixture.get(getRepositoryToken(AuditoriaCartera));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));

    await auditoriaRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-CUOTAS-1" });
    await socioRepo.delete({ codigo: "SC-CUOTAS-1" });

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
      usuario: "socio-cuotas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-cuotas-1@correo.com",
      telefono: "+59171160033",
      codigo: "SC-CUOTAS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-cuotas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-cuotas-1@correo.com",
      telefono: "+59172270033",
      codigo: "CB-CUOTAS-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta CUOTAS",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
      });
    rutaId = rutaRes.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Juan",
        apellido: "Cuotas",
        negocio: "Tienda",
        telefonoWhatsapp: "+59171160034",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        clienteId,
        valor: 1000,
        numCuotas: 4,
        diasEntreCuotas: 7,
      });
    prestamoId = prestamoRes.body.id as number;
  });

  afterAll(async () => {
    await auditoriaRepo.createQueryBuilder().delete().execute();
    await abonoRepo.createQueryBuilder().delete().execute();
    await pagoRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.delete({ id: prestamoId });
    await clienteRepo.delete({ id: clienteId });
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-CUOTAS-1" });
    await socioRepo.delete({ codigo: "SC-CUOTAS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  async function obtenerCuota(numero: number): Promise<Cuota> {
    const cuota = await cuotaRepo.findOne({ where: { prestamo: { id: prestamoId }, numeroCuota: numero } });
    if (!cuota) throw new Error(`Cuota ${numero} no encontrada`);
    return cuota;
  }

  it("PATCH /rutas/:id/cuotas/:cuotaId edita el valor con auditoría y sin tocar caja", async () => {
    const cuota = await obtenerCuota(1);
    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });

    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 300, password: ADMIN_PASSWORD, motivo: "corrección de captura" });

    expect(res.status).toBe(200);
    expect(res.body.valorEsperado).toBe(300);

    const auditoria = await auditoriaRepo.findOne({ where: { entidad: "cuota", entidadId: cuota.id, operacion: "editar" } });
    expect(auditoria).toBeDefined();
    expect(auditoria?.valoresAntes).toMatchObject({ valorEsperado: cuota.valorEsperado });
    expect(auditoria?.actorRol).toBe("admin");
    expect(auditoria?.motivo).toBe("corrección de captura");

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual);
  });

  it("PATCH /rutas/:id/cuotas/:cuotaId con password incorrecta -> 401", async () => {
    const cuota = await obtenerCuota(1);
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 100, password: "incorrecta", motivo: "m" });

    expect(res.status).toBe(401);
  });

  it("PATCH /rutas/:id/cuotas/:cuotaId sin motivo -> 400", async () => {
    const cuota = await obtenerCuota(1);
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 100, password: ADMIN_PASSWORD, motivo: "" });

    expect(res.status).toBe(400);
  });

  it("DELETE /rutas/:id/cuotas/:cuotaId elimina la cuota pagada, revierte caja y deja el pago con cuota_id nulo", async () => {
    const cuota = await obtenerCuota(2);
    await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: cuota.id, valor: cuota.valorEsperado, metodoPago: "efectivo" });

    const pagoAntes = await pagoRepo.findOne({ where: { cuota: { id: cuota.id } } });
    expect(pagoAntes).toBeDefined();
    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });

    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ password: ADMIN_PASSWORD, motivo: "error de captura" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(cuota.id);

    const cuotaEliminada = await cuotaRepo.findOne({ where: { id: cuota.id } });
    expect(cuotaEliminada).toBeNull();

    const pagoDespues = await pagoRepo.findOne({ where: { id: pagoAntes!.id } });
    expect(pagoDespues).toBeDefined();
    expect(pagoDespues?.cuotaId).toBeNull();

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual - cuota.valorEsperado);

    const auditoria = await auditoriaRepo.findOne({ where: { entidad: "cuota", entidadId: cuota.id, operacion: "eliminar" } });
    expect(auditoria).toBeDefined();
    expect(auditoria?.valoresAntes).toMatchObject({ estatus: "pagada" });
  });

  it("DELETE /rutas/:id/abonos/:abonoId elimina el abono, revierte caja y audita", async () => {
    const abonoRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, valor: 50, metodoPago: "transferencia" });
    const abonoId = abonoRes.body.id as number;

    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });

    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaId}/abonos/${abonoId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ password: ADMIN_PASSWORD, motivo: "abono duplicado" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(abonoId);

    const abonoEliminado = await abonoRepo.findOne({ where: { id: abonoId } });
    expect(abonoEliminado).toBeNull();

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual - 50);

    const auditoria = await auditoriaRepo.findOne({ where: { entidad: "abono", entidadId: abonoId, operacion: "eliminar" } });
    expect(auditoria).toBeDefined();
    expect(auditoria?.valoresAntes).toMatchObject({ valor: 50 });
    expect(auditoria?.motivo).toBe("abono duplicado");
  });

  it("DELETE /rutas/:id/abonos/:abonoId con password incorrecta -> 401", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaId}/abonos/999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ password: "incorrecta", motivo: "m" });

    expect(res.status).toBe(401);
  });

  it("PATCH /rutas/:id/cuotas/:cuotaId con campo extra -> 400", async () => {
    const cuota = await obtenerCuota(3);
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 100, password: ADMIN_PASSWORD, motivo: "m", extra: "no" });

    expect(res.status).toBe(400);
  });

  it("PATCH /rutas/:id/cuotas/:cuotaId con cuota inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/cuotas/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 100, password: ADMIN_PASSWORD, motivo: "m" });

    expect(res.status).toBe(404);
  });
});