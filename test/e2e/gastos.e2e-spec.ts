import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Caja } from "../../src/modules/rutas/caja.entity";
import { Gasto } from "../../src/modules/rutas/gasto.entity";
import { GastoEvidencia } from "../../src/modules/rutas/gasto-evidencia.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Registro y aprobación de gastos (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let gastoRepo: Repository<Gasto>;
  let evidenciaRepo: Repository<GastoEvidencia>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let rutaId: number;

  const ADMIN_USERNAME = "gastos-e2e-admin";
  const ADMIN_PASSWORD = "gastos-e2e-password";
  const PASSWORD = "password-seguro";

  beforeAll(async () => {
    process.env.JWT_SECRET = "gastos-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "gastos-e2e-refresh-secret";
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
    gastoRepo = moduleFixture.get(getRepositoryToken(Gasto));
    evidenciaRepo = moduleFixture.get(getRepositoryToken(GastoEvidencia));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));

    await evidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-GASTOS-1" });
    await socioRepo.delete({ codigo: "SC-GASTOS-1" });

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
      usuario: "socio-gastos-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-gastos-1@correo.com",
      telefono: "+59171160032",
      codigo: "SC-GASTOS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-gastos-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-gastos-1@correo.com",
      telefono: "+59172270032",
      codigo: "CB-GASTOS-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta GASTOS",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
      });
    rutaId = rutaRes.body.id as number;
  });

  afterAll(async () => {
    await evidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-GASTOS-1" });
    await socioRepo.delete({ codigo: "SC-GASTOS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas/:id/gastos registra el gasto pendiente con evidencia", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/gastos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .field("descripcion", "Combustible")
      .field("valor", "50")
      .attach("evidencias", Buffer.from("pdf-data"), "factura.pdf");

    expect(res.status).toBe(201);
    expect(res.body.descripcion).toBe("Combustible");
    expect(res.body.aprobado).toBe(false);

    const evidencia = await evidenciaRepo.findOne({ where: { gasto: { id: res.body.id } } });
    expect(evidencia).toBeDefined();
    expect(evidencia?.nombreOriginal).toBe("factura.pdf");
  });

  it("no descuenta la caja al registrar (pendiente)", async () => {
    const caja = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(caja?.saldoActual).toBe(1000);
  });

  it("PATCH /rutas/:id/gastos/:gastoId/aprobar aprueba y descuenta la caja", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/gastos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .field("descripcion", "Peaje")
      .field("valor", "30")
      .attach("evidencias", Buffer.from("img"), "peaje.jpg");

    const gastoId = res.body.id as number;
    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });

    const aprobar = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/gastos/${gastoId}/aprobar`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(aprobar.status).toBe(200);
    expect(aprobar.body.aprobado).toBe(true);

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual - 30);
  });

  it("DELETE /rutas/:id/gastos/:gastoId elimina (soft-delete) y revierte la caja si estaba aprobado", async () => {
    const gasto = await gastoRepo.findOne({ where: { ruta: { id: rutaId }, aprobado: true } });
    const cajaAntes = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });

    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaId}/gastos/${gasto!.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("eliminado");

    const cajaDespues = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + gasto!.valor);
  });

  it("POST /rutas/:id/gastos sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/gastos`)
      .field("descripcion", "X")
      .field("valor", "10");

    expect(res.status).toBe(401);
  });
});
