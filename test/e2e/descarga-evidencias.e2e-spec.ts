import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { ClienteEvidencia } from "../../src/modules/cartera/cliente-evidencia.entity";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Gasto } from "../../src/modules/rutas/gasto.entity";
import { GastoEvidencia } from "../../src/modules/rutas/gasto-evidencia.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Descarga de evidencias (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let gastoRepo: Repository<Gasto>;
  let gastoEvidenciaRepo: Repository<GastoEvidencia>;
  let clienteRepo: Repository<Cliente>;
  let clienteEvidenciaRepo: Repository<ClienteEvidencia>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;

  let accessTokenAdmin: string;
  let rutaId: number;
  let gastoId: number;
  let gastoEvidenciaId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "descarga-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Descarga2026";
  const PASSWORD = "Socio#Descarga2026";

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
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
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-DESC-1" });
    await socioRepo.delete({ codigo: "SC-DESC-1" });
    await socioRepo.delete({ codigo: "SC-DESC-2" });
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
      usuario: "socio-desc-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-desc-1@correo.com",
      telefono: "+59171160050",
      codigo: "SC-DESC-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-desc-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-desc-1@correo.com",
      telefono: "+59172270050",
      codigo: "CB-DESC-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta DESCARGA",
        socioId: socio.id,
        cobradorId: cobrador.id,
        tipoInteres: 20,
        numCuotas: 4,
        moneda: "BOB",
        saldoInicial: 1000,
        costoCobro: 250,
      });
    rutaId = rutaRes.body.id as number;

    const gastoRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/gastos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .field("descripcion", "Combustible")
      .field("valor", "50")
      .attach("evidencias", Buffer.from("pdf-data"), "factura.pdf");
    gastoId = gastoRes.body.id as number;
    const evidencia = await gastoEvidenciaRepo.findOne({ where: { gasto: { id: gastoId } } });
    gastoEvidenciaId = evidencia!.id;

    const clienteRes = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
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
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await gastoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-DESC-1" });
    await socioRepo.delete({ codigo: "SC-DESC-1" });
    await socioRepo.delete({ codigo: "SC-DESC-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET evidencia de gasto devuelve el archivo inline", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/gastos/${gastoId}/evidencias/${gastoEvidenciaId}`)
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
      .get(`/rutas/${rutaId}/gastos/${gastoId}/evidencias/${gastoEvidenciaId}?descargar=1`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain("factura.pdf");
  });

  it("GET evidencia de gasto inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/gastos/${gastoId}/evidencias/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("GET evidencia de gasto sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).get(
      `/rutas/${rutaId}/gastos/${gastoId}/evidencias/${gastoEvidenciaId}`,
    );

    expect(res.status).toBe(401);
  });

  it("GET foto de cliente devuelve el archivo", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/clientes/${clienteId}/evidencias/foto_facial`)
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
      `/rutas/${rutaId}/clientes/${clienteId}/evidencias/foto_facial`,
    );

    expect(res.status).toBe(401);
  });

  it("GET evidencia de cliente con tipo inválido -> 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/clientes/${clienteId}/evidencias/otro`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("un socio SIN ver_reportes no puede descargar -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-desc-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S2",
      apellido: "E2E",
      correo: "socio-desc-2@correo.com",
      telefono: "+59171160052",
      codigo: "SC-DESC-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-desc-2", password: PASSWORD });
    const tokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/rutas/${rutaId}/gastos/${gastoId}/evidencias/${gastoEvidenciaId}`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });
});
