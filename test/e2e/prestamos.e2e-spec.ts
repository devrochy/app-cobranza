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
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Registro de préstamos (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let accessTokenAdmin: string;
  let carteraId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "prestamos-e2e-admin";
  const ADMIN_PASSWORD = "prestamos-e2e-password";
  const PASSWORD = "password-seguro";

  const clienteDto = {
    nombre: "Juan",
    apellido: "Pérez",
    negocio: "Tienda",
    telefonoWhatsapp: "+59171160001",
    tipoDocumento: "ci",
    numeroDocumento: "1234567",
    latitud: -17.78,
    longitud: -63.18,
  };

  const prestamoDto = {
    clienteId: 0,
    valor: 1000,
    numCuotas: 8,
    diasEntreCuotas: 7,
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "prestamos-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "prestamos-e2e-refresh-secret";
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
      usuario: "propietario-prest-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-prest-1@correo.com",
      telefono: "+59171160002",
      codigo: "SC-PREST-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-prest-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-prest-1@correo.com",
      telefono: "+59172270001",
      codigo: "CB-PREST-1",
      estatus: "activo",
    });

    const cartera = await carteraRepo.save({
      propietario: { id: propietario.id },
      gestor: { id: gestor.id },
      nombre: "Cartera PREST-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraId = cartera.id;

    await request(app.getHttpServer())
      .put(`/carteras/${carteraId}/cartera-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ manejoCupoActivo: true, cupoDefault: 1500, cuotasMinimasPrestamo: 2 });
  });

  afterAll(async () => {
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE cartera_id = :carteraId)", { carteraId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("cartera_id = :carteraId", { carteraId }).execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-PREST-1" });
    await propietarioRepo.delete({ codigo: "SC-PREST-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /carteras/:carteraId/clientes -> 201 con color blanco", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/clientes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(clienteDto);

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe("Juan");
    expect(res.body.colorRiesgo).toBe("blanco");
    expect(res.body.latitud).toBeCloseTo(-17.78, 5);
    expect(res.body.longitud).toBeCloseTo(-63.18, 5);
    clienteId = res.body.id as number;
    prestamoDto.clienteId = clienteId;
  });

  it("POST /carteras/:carteraId/prestamos -> 201 con cuotas generadas", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(prestamoDto);

    expect(res.status).toBe(201);
    expect(res.body.valor).toBe(1000);
    expect(res.body.tipoInteres).toBe(20);
    expect(res.body.cuotas).toHaveLength(8);
    const suma = res.body.cuotas.reduce((s: number, c: { valorEsperado: number }) => s + c.valorEsperado, 0);
    expect(suma).toBeCloseTo(1200, 2);
    expect(res.body.cuotas[0].fechaVencimiento > res.body.fechaOtorgado).toBe(true);
  });

  it("el cliente queda con color azul tras el préstamo (sin atraso)", async () => {
    const cliente = await clienteRepo.findOne({ where: { id: clienteId } });
    expect(cliente?.colorRiesgo).toBe("azul");
  });

  it("POST /carteras/:carteraId/prestamos que excede el cupo -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, valor: 1000 });

    expect(res.status).toBe(409);
  });

  it("POST /carteras/:carteraId/prestamos con numCuotas menor al mínimo -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, numCuotas: 1 });

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:carteraId/prestamos con datos inválidos -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, valor: 0, diasEntreCuotas: 0 });

    expect(res.status).toBe(400);
  });

  it("POST /carteras/:carteraId/prestamos con cliente inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, clienteId: 999999 });

    expect(res.status).toBe(404);
  });

  it("POST /carteras/999999/prestamos -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/999999/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(prestamoDto);

    expect(res.status).toBe(404);
  });

  it("POST /carteras/:carteraId/prestamos con campo desconocido -> 400 (forbidNonWhitelisted)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, campo_inventado: true });

    expect(res.status).toBe(400);
  });

  it("un propietario sin permiso no puede registrar préstamos -> 403", async () => {
    const propietarioSinPermiso = await propietarioRepo.save({
      usuario: "propietario-prest-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-prest-2@correo.com",
      telefono: "+59171160003",
      codigo: "SC-PREST-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-prest-2", password: PASSWORD });
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .set("Authorization", `Bearer ${token}`)
      .send(prestamoDto);

    expect(res.status).toBe(403);
    await propietarioRepo.delete({ id: propietarioSinPermiso.id });
  });

  it("POST /carteras/:carteraId/prestamos sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/carteras/${carteraId}/prestamos`)
      .send(prestamoDto);

    expect(res.status).toBe(401);
  });
});
