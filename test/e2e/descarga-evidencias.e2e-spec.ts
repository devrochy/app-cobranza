import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { ClienteEvidencia } from "../../src/modules/clientes/cliente-evidencia.entity";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Gasto } from "../../src/modules/carteras/gasto.entity";
import { GastoEvidencia } from "../../src/modules/carteras/gasto-evidencia.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Descarga de evidencias (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let gastoRepo: Repository<Gasto>;
  let gastoEvidenciaRepo: Repository<GastoEvidencia>;
  let clienteRepo: Repository<Cliente>;
  let clienteEvidenciaRepo: Repository<ClienteEvidencia>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;

  let accessTokenAdmin: string;
  let carteraId: number;
  let gastoId: number;
  let gastoEvidenciaId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "descarga-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Descarga2026";
  const PASSWORD = "Propietario#Descarga2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "descarga-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "descarga-e2e-refresh-secret";
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
    gastoEvidenciaRepo = moduleFixture.get(getRepositoryToken(GastoEvidencia));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    clienteEvidenciaRepo = moduleFixture.get(getRepositoryToken(ClienteEvidencia));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));

    await clienteEvidenciaRepo.createQueryBuilder().delete().execute();
    await gastoEvidenciaRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await gastoRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-DESC-1" });
    await propietarioRepo.delete({ codigo: "SC-DESC-1" });
    await propietarioRepo.delete({ codigo: "SC-DESC-2" });
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
      usuario: "propietario-desc-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-desc-1@correo.com",
      telefono: "+59171160050",
      codigo: "SC-DESC-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-desc-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-desc-1@correo.com",
      telefono: "+59172270050",
      codigo: "CB-DESC-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera DESCARGA",
        propietarioId: propietario.id,
        gestorId: gestor.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    carteraId = carteraRes.body.id as number;

    const gastoRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/gastos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .field("descripcion", "Combustible")
      .field("valor", "50")
      .attach("evidencias", Buffer.from("pdf-data"), "factura.pdf");
    gastoId = gastoRes.body.id as number;
    const evidencia = await gastoEvidenciaRepo.findOne({ where: { gasto: { id: gastoId } } });
    gastoEvidenciaId = evidencia!.id;

    const clienteRes = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .field("nombre", "Juan")
      .field("apellido", "Descarga")
      .field("telefonoWhatsapp", "+59171160051")
      .field("tipoDocumento", "ci")
      .field("numeroDocumento", "1234567")
      .field("latitud", "-17.78")
      .field("longitud", "-63.18")
      .attach("foto_facial", Buffer.from("img-data"), "foto.jpg");
    clienteId = clienteRes.body.id as number;
  });

  afterAll(async () => {
    await clienteEvidenciaRepo.createQueryBuilder().delete().execute();
    await gastoEvidenciaRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await gastoRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-DESC-1" });
    await propietarioRepo.delete({ codigo: "SC-DESC-1" });
    await propietarioRepo.delete({ codigo: "SC-DESC-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET evidencia de gasto devuelve el archivo inline", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/gastos/${gastoId}/evidencias/${gastoEvidenciaId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("inline");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.body.toString()).toBe("pdf-data");
  });

  it("GET evidencia de gasto con ?descargar=1 fuerza attachment", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/gastos/${gastoId}/evidencias/${gastoEvidenciaId}?descargar=1`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain("factura.pdf");
  });

  it("GET evidencia de gasto inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/gastos/${gastoId}/evidencias/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET evidencia de gasto sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(
      `/carteras/${carteraId}/gastos/${gastoId}/evidencias/${gastoEvidenciaId}`,
    );

    expect(res.status).toBe(401);
  });

  it("GET foto de cliente devuelve el archivo", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/evidencias/foto_facial`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/jpeg");
    expect(res.body.toString()).toBe("img-data");
  });

  it("GET evidencia de cliente sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(
      `/carteras/${carteraId}/clientes/${clienteId}/evidencias/foto_facial`,
    );

    expect(res.status).toBe(401);
  });

  it("GET evidencia de cliente con tipo inválido -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/clientes/${clienteId}/evidencias/otro`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("un propietario SIN ver_reportes no puede descargar -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-desc-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "propietario-desc-2@correo.com",
      telefono: "+59171160052",
      codigo: "SC-DESC-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-desc-2", password: PASSWORD });
    const tokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/carteras/${carteraId}/gastos/${gastoId}/evidencias/${gastoEvidenciaId}`)
      .set("Authorization", `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });
});
