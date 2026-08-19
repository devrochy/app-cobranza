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
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Registro de préstamos (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let prestamoRepo: Repository<Prestamo>;
  let cuotaRepo: Repository<Cuota>;
  let accessTokenAdmin: string;
  let rutaId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "prestamos-e2e-admin";
  const ADMIN_PASSWORD = "prestamos-e2e-password";
  const PASSWORD = "password-seguro";

  const clienteDto = {
    nombre: "Juan",
    apellido: "Pérez",
    negocio: "Tienda",
    telefonoWhatsapp: "+59171160001",
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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
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

    const socio = await socioRepo.save({
      usuario: "socio-prest-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-prest-1@correo.com",
      telefono: "+59171160002",
      codigo: "SC-PREST-1",
      moneda: "BOB",
      estatus: "activo",
    });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-prest-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-prest-1@correo.com",
      telefono: "+59172270001",
      codigo: "CB-PREST-1",
      estatus: "activo",
    });

    const ruta = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta PREST-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaId = ruta.id;

    await request(app.getHttpServer())
      .put(`/rutas/${rutaId}/ruta-config`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ manejoCupoActivo: true, cupoDefault: 1500, cuotasMinimasPrestamo: 2 });
  });

  afterAll(async () => {
    await cuotaRepo.createQueryBuilder().delete().where("prestamo_id IN (SELECT id FROM prestamos WHERE ruta_id = :rutaId)", { rutaId }).execute();
    await prestamoRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await clienteRepo.createQueryBuilder().delete().where("ruta_id = :rutaId", { rutaId }).execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-PREST-1" });
    await socioRepo.delete({ codigo: "SC-PREST-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("POST /rutas/:rutaId/clientes -> 201 con color blanco", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/clientes`)
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

  it("POST /rutas/:rutaId/prestamos -> 201 con cuotas generadas", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
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

  it("POST /rutas/:rutaId/prestamos que excede el cupo -> 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, valor: 1000 });

    expect(res.status).toBe(409);
  });

  it("POST /rutas/:rutaId/prestamos con numCuotas menor al mínimo -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, numCuotas: 1 });

    expect(res.status).toBe(400);
  });

  it("POST /rutas/:rutaId/prestamos con datos inválidos -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, valor: 0, diasEntreCuotas: 0 });

    expect(res.status).toBe(400);
  });

  it("POST /rutas/:rutaId/prestamos con cliente inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, clienteId: 999999 });

    expect(res.status).toBe(404);
  });

  it("POST /rutas/999999/prestamos -> 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/999999/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send(prestamoDto);

    expect(res.status).toBe(404);
  });

  it("POST /rutas/:rutaId/prestamos con campo desconocido -> 400 (forbidNonWhitelisted)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ ...prestamoDto, campo_inventado: true });

    expect(res.status).toBe(400);
  });

  it("un socio sin permiso no puede registrar préstamos -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-prest-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-prest-2@correo.com",
      telefono: "+59171160003",
      codigo: "SC-PREST-2",
      moneda: "BOB",
      estatus: "activo",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-prest-2", password: PASSWORD });
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .set("Authorization", `Bearer ${token}`)
      .send(prestamoDto);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });

  it("POST /rutas/:rutaId/prestamos sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/rutas/${rutaId}/prestamos`)
      .send(prestamoDto);

    expect(res.status).toBe(401);
  });
});
