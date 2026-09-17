import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Abono } from "../../src/modules/clientes/abono.entity";
import { AuditoriaCartera } from "../../src/modules/clientes/auditoria-cartera.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Pago } from "../../src/modules/clientes/pago.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Caja } from "../../src/modules/carteras/caja.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Gestión de cuotas y abonos con auditoría (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let pagoRepo: Repository<Pago>;
  let abonoRepo: Repository<Abono>;
  let auditoriaRepo: Repository<AuditoriaCartera>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;
  let prestamoId: number;

  const ADMIN_USERNAME = "cuotas-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Cuotas2026";
  const PASSWORD = "Propietario#Cuotas2026";

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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
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
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-CUOTAS-1" });
    await propietarioRepo.delete({ codigo: "SC-CUOTAS-1" });

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
      usuario: "propietario-cuotas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-cuotas-1@correo.com",
      telefono: "+59171160033",
      codigo: "SC-CUOTAS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-cuotas-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-cuotas-1@correo.com",
      telefono: "+59172270033",
      codigo: "CB-CUOTAS-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera CUOTAS",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    const clienteRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Juan",
        apellido: "Cuotas",
        negocio: "Tienda",
        telefonoWhatsapp: "+59171160034",
        tipoDocumento: "ci",
        numeroDocumento: "1234567",
        latitud: -17.78,
        longitud: -63.18,
      });
    clienteId = clienteRes.body.id as number;

    const prestamoRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
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
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-CUOTAS-1" });
    await propietarioRepo.delete({ codigo: "SC-CUOTAS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  async function obtenerCuota(numero: number): Promise<Cuota> {
    const cuota = await cuotaRepo.findOne({ where: { prestamo: { id: prestamoId }, numeroCuota: numero } });
    if (!cuota) throw new Error(`Cuota ${numero} no encontrada`);
    return cuota;
  }

  it("PATCH /carteras/:id/cuotas/:cuotaId edita el valor con auditoría y sin tocar caja", async () => {
    const cuota = await obtenerCuota(1);
    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });

    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 300, password: ADMIN_PASSWORD, motivo: "corrección de captura" });

    expect(res.status).toBe(200);
    expect(res.body.valorEsperado).toBe(300);

    const auditoria = await auditoriaRepo.findOne({ where: { entidad: "cuota", entidadId: cuota.id, operacion: "editar" } });
    expect(auditoria).toBeDefined();
    expect(auditoria?.valoresAntes).toMatchObject({ valorEsperado: cuota.valorEsperado });
    expect(auditoria?.actorRol).toBe("admin");
    expect(auditoria?.motivo).toBe("corrección de captura");

    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual);
  });

  it("PATCH /carteras/:id/cuotas/:cuotaId con password incorrecta -> 401", async () => {
    const cuota = await obtenerCuota(1);
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 100, password: "incorrecta", motivo: "m" });

    expect(res.status).toBe(401);
  });

  it("PATCH /carteras/:id/cuotas/:cuotaId sin motivo -> 400", async () => {
    const cuota = await obtenerCuota(1);
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 100, password: ADMIN_PASSWORD, motivo: "" });

    expect(res.status).toBe(400);
  });

  it("DELETE /carteras/:id/cuotas/:cuotaId de una cuota pagada -> 400 (primero revertir el pago)", async () => {
    const cuota = await obtenerCuota(2);
    await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: cuota.id, valor: cuota.valorEsperado, metodoPago: "efectivo" });

    const pago = await pagoRepo.findOne({ where: { cuota: { id: cuota.id } } });
    expect(pago).toBeDefined();

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ password: ADMIN_PASSWORD, motivo: "error de captura" });

    expect(res.status).toBe(400);

    // La cuota sigue existiendo y pagada, y el pago sigue ligado (sin huérfano).
    const cuotaSigue = await cuotaRepo.findOne({ where: { id: cuota.id } });
    expect(cuotaSigue?.estatus).toBe("pagada");
    const pagoSigue = await pagoRepo.findOne({ where: { id: pago!.id } });
    expect(pagoSigue?.cuotaId).toBe(cuota.id);
  });

  it("DELETE /carteras/:id/pagos/:pagoId borra el pago, reabre la cuota y revierte caja", async () => {
    const cuota = await obtenerCuota(3);
    const pagoRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: cuota.id, valor: cuota.valorEsperado, metodoPago: "efectivo" });
    const pagoId = pagoRes.body.id as number;

    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/pagos/${pagoId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ password: ADMIN_PASSWORD, motivo: "pago duplicado" });

    expect(res.status).toBe(200);
    expect(await pagoRepo.findOne({ where: { id: pagoId } })).toBeNull();
    expect((await cuotaRepo.findOne({ where: { id: cuota.id } }))?.estatus).toBe("pendiente");
    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual - cuota.valorEsperado);
  });

  it("DELETE /carteras/:id/pagos/:pagoId de un pago liquidado -> 400", async () => {
    const cuota = await obtenerCuota(4);
    const pagoRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: cuota.id, valor: cuota.valorEsperado, metodoPago: "efectivo" });
    const pagoId = pagoRes.body.id as number;
    await pagoRepo.update(pagoId, { liquidado: true });

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/pagos/${pagoId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ password: ADMIN_PASSWORD, motivo: "error" });

    expect(res.status).toBe(400);
  });

  it("un propietario sin eliminar_pago no puede borrar un pago -> 403", async () => {
    const propietarioLogin = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-cuotas-1", password: PASSWORD });
    const accessTokenPropietario = propietarioLogin.body.accessToken as string;

    const cuota = await obtenerCuota(1);
    const pagoRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/pagos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ cuotaId: cuota.id, valor: cuota.valorEsperado, metodoPago: "efectivo" });
    const pagoId = pagoRes.body.id as number;

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/pagos/${pagoId}`)
      .set("Authorization", `Bearer ${accessTokenPropietario}`)
      .send({ password: PASSWORD, motivo: "error" });

    expect(res.status).toBe(403);
  });

  it("DELETE /carteras/:id/abonos/:abonoId elimina el abono, revierte caja y audita", async () => {
    const abonoRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/abonos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ prestamoId, valor: 50, metodoPago: "transferencia" });
    const abonoId = abonoRes.body.id as number;

    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/abonos/${abonoId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ password: ADMIN_PASSWORD, motivo: "abono duplicado" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(abonoId);

    const abonoEliminado = await abonoRepo.findOne({ where: { id: abonoId } });
    expect(abonoEliminado).toBeNull();

    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual - 50);

    const auditoria = await auditoriaRepo.findOne({ where: { entidad: "abono", entidadId: abonoId, operacion: "eliminar" } });
    expect(auditoria).toBeDefined();
    expect(auditoria?.valoresAntes).toMatchObject({ valor: 50 });
    expect(auditoria?.motivo).toBe("abono duplicado");
  });

  it("DELETE /carteras/:id/abonos/:abonoId con password incorrecta -> 401", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/abonos/999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ password: "incorrecta", motivo: "m" });

    expect(res.status).toBe(401);
  });

  it("PATCH /carteras/:id/cuotas/:cuotaId con campo extra -> 400", async () => {
    const cuota = await obtenerCuota(3);
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/cuotas/${cuota.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 100, password: ADMIN_PASSWORD, motivo: "m", extra: "no" });

    expect(res.status).toBe(400);
  });

  it("PATCH /carteras/:id/cuotas/:cuotaId con cuota inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/cuotas/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valorEsperado: 100, password: ADMIN_PASSWORD, motivo: "m" });

    expect(res.status).toBe(404);
  });
});