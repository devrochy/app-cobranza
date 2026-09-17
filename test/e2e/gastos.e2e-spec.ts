import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Caja } from "../../src/modules/carteras/caja.entity";
import { Gasto } from "../../src/modules/carteras/gasto.entity";
import { GastoEvidencia } from "../../src/modules/carteras/gasto-evidencia.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Registro y aprobación de gastos (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let gastoRepo: Repository<Gasto>;
  let evidenciaRepo: Repository<GastoEvidencia>;
  let cajaRepo: Repository<Caja>;
  let accessTokenAdmin: string;
  let carteraId: number;

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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    gastoRepo = moduleFixture.get(getRepositoryToken(Gasto));
    evidenciaRepo = moduleFixture.get(getRepositoryToken(GastoEvidencia));
    cajaRepo = moduleFixture.get(getRepositoryToken(Caja));

    await evidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-GASTOS-1" });
    await propietarioRepo.delete({ codigo: "SC-GASTOS-1" });

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
      usuario: "propietario-gastos-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-gastos-1@correo.com",
      telefono: "+59171160032",
      codigo: "SC-GASTOS-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-gastos-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-gastos-1@correo.com",
      telefono: "+59172270032",
      codigo: "CB-GASTOS-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera GASTOS",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;
  });

  afterAll(async () => {
    await evidenciaRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-GASTOS-1" });
    await propietarioRepo.delete({ codigo: "SC-GASTOS-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /carteras/:id/gastos registra el gasto pendiente con evidencia", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/gastos`)
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
    const caja = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(caja?.saldoActual).toBe(1000);
  });

  it("PATCH /carteras/:id/gastos/:gastoId/aprobar aprueba y descuenta la caja", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/gastos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .field("descripcion", "Peaje")
      .field("valor", "30")
      .attach("evidencias", Buffer.from("img"), "peaje.jpg");

    const gastoId = res.body.id as number;
    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });

    const aprobar = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/gastos/${gastoId}/aprobar`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(aprobar.status).toBe(200);
    expect(aprobar.body.aprobado).toBe(true);

    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual - 30);
  });

  it("DELETE /carteras/:id/gastos/:gastoId elimina (soft-delete) y revierte la caja si estaba aprobado", async () => {
    const gasto = await gastoRepo.findOne({ where: { cartera: { id: carteraId }, aprobado: true } });
    const cajaAntes = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });

    const res = await request(app.getHttpServer())
      .delete(`/carteras/${carteraId}/gastos/${gasto!.id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("eliminado");

    const cajaDespues = await cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    expect(cajaDespues?.saldoActual).toBe(cajaAntes!.saldoActual + gasto!.valor);
  });

  it("GET /carteras/:id/gastos lista los gastos activos con sus evidencias", async () => {
    const crear = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/gastos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .field("descripcion", "Listable")
      .field("valor", "15")
      .attach("evidencias", Buffer.from("pdf-data"), "listable.pdf");
    expect(crear.status).toBe(201);

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/gastos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const gasto = res.body.find((g: { id: number; descripcion: string }) => g.id === crear.body.id);
    expect(gasto).toBeDefined();
    expect(gasto.evidencias).toHaveLength(1);
    expect(gasto.evidencias[0].nombreOriginal).toBe("listable.pdf");
  });

  it("POST /carteras/:id/gastos sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/gastos`)
      .field("descripcion", "X")
      .field("valor", "10");

    expect(res.status).toBe(401);
  });
});
