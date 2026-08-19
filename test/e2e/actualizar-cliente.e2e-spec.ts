import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { CambioClientePendiente } from "../../src/modules/cartera/cambio-cliente-pendiente.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Actualización de cliente con aprobación (HU-47, e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let cambioRepo: Repository<CambioClientePendiente>;
  let accessTokenAdmin: string;
  let accessTokenSocio: string;
  let rutaId: number;
  let clienteId: number;

  const ADMIN_USERNAME = "actclie-e2e-admin";
  const ADMIN_PASSWORD = "actclie-e2e-password";
  const PASSWORD = "password-seguro";
  let socioId: number;

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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    cambioRepo = moduleFixture.get(getRepositoryToken(CambioClientePendiente));

    await cambioRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await rutaRepo.createQueryBuilder().delete().execute();
    await cobradorRepo.delete({ codigo: "CB-ACTCLIE-1" });
    await socioRepo.delete({ codigo: "SC-ACTCLIE-1" });

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
      usuario: "socio-actclie-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-actclie-1@correo.com",
      telefono: "+59171160052",
      codigo: "SC-ACTCLIE-1",
      moneda: "BOB",
      estatus: "activo",
    });
    socioId = socio.id;

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-actclie-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-actclie-1@correo.com",
      telefono: "+59172270052",
      codigo: "CB-ACTCLIE-1",
      estatus: "activo",
    });

    const rutaRes = await request(app.getHttpServer())
      .post("/rutas")
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({
        nombre: "Ruta ACTCLIE",
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
      .field("nombre", "Juan")
      .field("apellido", "Cliente")
      .field("telefonoWhatsapp", "+59171160053")
      .field("latitud", "-17.78")
      .field("longitud", "-63.18");
    clienteId = clienteRes.body.id as number;
  });

  afterAll(async () => {
    await cambioRepo.createQueryBuilder().delete().execute();
    await clienteRepo.createQueryBuilder().delete().execute();
    await rutaRepo.delete({ id: rutaId });
    await cobradorRepo.delete({ codigo: "CB-ACTCLIE-1" });
    await socioRepo.delete({ codigo: "SC-ACTCLIE-1" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("el admin actualiza el cliente directamente (tiene permiso)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/clientes/${clienteId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ nombre: "Juan Carlos" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Juan Carlos");
  });

  it("un socio sin actualizar_cliente genera una propuesta pendiente", async () => {
    await request(app.getHttpServer())
      .put(`/socios/${socioId}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_ruta: true } });
    const login = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario: "socio-actclie-1", password: PASSWORD });
    accessTokenSocio = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/clientes/${clienteId}`)
      .set("Authorization", `Bearer ${accessTokenSocio}`)
      .send({ apellido: "García" });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("pendiente");
  });

  it("el admin aprueba la propuesta pendiente y aplica el cambio", async () => {
    const propuesta = await cambioRepo.findOne({ where: { cliente: { id: clienteId } } });
    const res = await request(app.getHttpServer())
      .patch(`/rutas/${rutaId}/cambios-cliente/${propuesta!.id}/decision`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ decision: "aprobar" });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("aprobado");

    const cliente = await clienteRepo.findOne({ where: { id: clienteId } });
    expect(cliente?.apellido).toBe("García");
  });
});
