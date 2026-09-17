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
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Registro ampliado de cliente y préstamo (HU-14, e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let evidenciaRepo: Repository<ClienteEvidencia>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "ampliar-e2e-admin";
  const ADMIN_PASSWORD = "ampliar-e2e-password";
  const PASSWORD = "password-seguro";

  beforeAll(async () => {
    process.env.JWT_SECRET = "ampliar-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "ampliar-e2e-refresh-secret";
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
    evidenciaRepo = moduleFixture.get(getRepositoryToken(ClienteEvidencia));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));

    await evidenciaRepo.createQueryBuilder().delete().execute();
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-AMPLIAR-1" });
    await propietarioRepo.delete({ codigo: "SC-AMPLIAR-1" });

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
      usuario: "propietario-ampliar-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-ampliar-1@correo.com",
      telefono: "+59171160042",
      codigo: "SC-AMPLIAR-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-ampliar-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-ampliar-1@correo.com",
      telefono: "+59172270042",
      codigo: "CB-AMPLIAR-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera AMPLIAR",
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
    await cuotaRepo.createQueryBuilder().delete().execute();
    await prestamoRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-AMPLIAR-1" });
    await propietarioRepo.delete({ codigo: "SC-AMPLIAR-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("registra cliente con tope de deuda, domicilio y foto facial", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .field("nombre", "Juan")
      .field("apellido", "Cliente")
      .field("telefonoWhatsapp", "+59171160043")
      .field("tipoDocumento", "ci")
      .field("numeroDocumento", "1234567")
      .field("latitud", "-17.78")
      .field("longitud", "-63.18")
      .field("latitudDomicilio", "-17.79")
      .field("longitudDomicilio", "-63.19")
      .field("topeMaximoDeuda", "8000")
      .attach("foto_facial", Buffer.from("img"), "cara.jpg");

    expect(res.status).toBe(201);
    expect(res.body.topeMaximoDeuda).toBe(8000);
    expect(res.body.latitudDomicilio).toBeCloseTo(-17.79, 5);
    clienteId = res.body.id as number;

    const evidencia = await evidenciaRepo.findOne({ where: { cliente: { id: clienteId } } });
    expect(evidencia).toBeDefined();
    expect(evidencia?.tipo).toBe("foto_facial");
  });

  it("rechaza crear préstamo que excede el tope de deuda del cliente -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ clienteId, valor: 9000, numCuotas: 4, diasEntreCuotas: 7 });

    expect(res.status).toBe(409);
  });

  it("registra préstamo con fiador y fecha dentro del rango", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        clienteId,
        valor: 2000,
        numCuotas: 4,
        diasEntreCuotas: 7,
        fiadorNombre: "Ana",
        fiadorApellido: "López",
        fiadorDocumento: "12345",
        fiadorTelefono: "+59170000000",
      });

    expect(res.status).toBe(201);
    const prestamo = await prestamoRepo.findOne({ where: { id: res.body.id } });
    expect(prestamo?.fiadorNombre).toBe("Ana");
    expect(prestamo?.fiadorTelefono).toBe("+59170000000");
  });

  it("rechaza préstamo con fecha más de 30 días -> 400", async () => {
    const fechaLejana = new Date();
    fechaLejana.setDate(fechaLejana.getDate() + 60);
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        clienteId,
        valor: 500,
        numCuotas: 4,
        diasEntreCuotas: 7,
        fechaOtorgado: fechaLejana.toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:id/clientes sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .field("nombre", "X")
      .field("apellido", "Y")
      .field("telefonoWhatsapp", "+59171160044")
      .field("tipoDocumento", "ci")
      .field("numeroDocumento", "1234567")
      .field("latitud", "-17")
      .field("longitud", "-63");

    expect(res.status).toBe(401);
  });


  describe("listados de cartera (GET clientes / prestamos / cambios + PATCH estatus)", () => {
    it("GET /carteras/:id/clientes devuelve el cliente creado", async () => {
      const res = await request(app.getHttpServer())
        .get(`/carteras/${carteraId}/clientes`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`);

      expect(res.status).toBe(200);
      const ids = res.body.map((c: { id: number }) => c.id);
      expect(ids).toContain(clienteId);
    });

    it("GET /carteras/:id/clientes/:clienteId/prestamos devuelve el préstamo con cuotas", async () => {
      const res = await request(app.getHttpServer())
        .get(`/carteras/${carteraId}/clientes/${clienteId}/prestamos`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].cuotas.length).toBeGreaterThan(0);
    });

    it("GET /carteras/:id/cambios-cliente devuelve la lista (sin cambios)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/carteras/${carteraId}/cambios-cliente`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("PATCH /carteras/:id/clientes/:clienteId/estatus bloquea el cliente", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/carteras/${carteraId}/clientes/${clienteId}/estatus`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .send({ estatus: "bloqueado" });

      expect(res.status).toBe(200);
      expect(res.body.estatus).toBe("bloqueado");
    });

    it("GET /carteras/:id/cambios-cliente con estado inválido -> 400", async () => {
      const res = await request(app.getHttpServer())
        .get(`/carteras/${carteraId}/cambios-cliente`)
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ estado: "invalido" });

      expect(res.status).toBe(400);
    });
  });
});
