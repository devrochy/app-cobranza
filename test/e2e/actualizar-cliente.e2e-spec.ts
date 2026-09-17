import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { CambioClientePendiente } from "../../src/modules/clientes/cambio-cliente-pendiente.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Actualización de cliente con aprobación (HU-47, e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;
  let cambioRepo: Repository<CambioClientePendiente>;
  let accessTokenAdmin: string;
  let accessTokenPropietario: string;
  let carteraId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "actclie-e2e-admin";
  const ADMIN_PASSWORD = "actclie-e2e-password";
  const PASSWORD = "password-seguro";
  let propietarioId: number;

  beforeAll(async () => {
    process.env.JWT_SECRET = "actclie-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "actclie-e2e-refresh-secret";
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
    cambioRepo = moduleFixture.get(getRepositoryToken(CambioClientePendiente));

    await cambioRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.createQueryBuilder().delete().execute();
    await gestorRepo.delete({ codigo: "CB-ACTCLIE-1" });
    await propietarioRepo.delete({ codigo: "SC-ACTCLIE-1" });

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
      usuario: "propietario-actclie-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-actclie-1@correo.com",
      telefono: "+59171160052",
      codigo: "SC-ACTCLIE-1",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioId = propietario.id;

    const gestor = await gestorRepo.save({
      propietario: { id: propietario.id },
      usuario: "gestor-actclie-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-actclie-1@correo.com",
      telefono: "+59172270052",
      codigo: "CB-ACTCLIE-1",
      estatus: "activo",
    });

    const carteraRes = await request(app.getHttpServer())
      .post("/carteras")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Cartera ACTCLIE",
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
      .field("nombre", "Juan")
      .field("apellido", "Cliente")
      .field("telefonoWhatsapp", "+59171160053")
      .field("tipoDocumento", "ci")
      .field("numeroDocumento", "1234567")
      .field("latitud", "-17.78")
      .field("longitud", "-63.18");
    clienteId = clienteRes.body.id as number;
  });

  afterAll(async () => {
    await cambioRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await carteraRepo.delete({ id: carteraId });
    await gestorRepo.delete({ codigo: "CB-ACTCLIE-1" });
    await propietarioRepo.delete({ codigo: "SC-ACTCLIE-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("el admin actualiza el cliente directamente (tiene permiso)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/clientes/${clienteId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "Juan Carlos" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Juan Carlos");
  });

  it("un propietario sin actualizar_cliente genera una propuesta pendiente", async () => {
    await request(app.getHttpServer())
      .put(`/propietarios/${propietarioId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_cartera: true } });
    const login = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario: "propietario-actclie-1", password: PASSWORD });
    accessTokenPropietario = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/clientes/${clienteId}`)
      .set("Authorization", `Bearer ${accessTokenPropietario}`)
      .send({ apellido: "García" });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("pendiente");
  });

  it("el admin aprueba la propuesta pendiente y aplica el cambio", async () => {
    const propuesta = await cambioRepo.findOne({ where: { cliente: { id: clienteId } } });
    const res = await request(app.getHttpServer())
      .patch(`/carteras/${carteraId}/cambios-cliente/${propuesta!.id}/decision`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ decision: "aprobar" });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("aprobado");

    const cliente = await clienteRepo.findOne({ where: { id: clienteId } });
    expect(cliente?.apellido).toBe("García");
  });
});
