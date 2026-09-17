import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";

describe("Conversaciones Admin↔Propietario (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let accessTokenAdmin: string;
  let tokenPropietario1: string;
  let tokenPropietario2: string;
  let propietario1Id: number;
  let propietario2Id: number;

  const ADMIN_USERNAME = "conv-e2e-admin";
  const ADMIN_PASSWORD = "conv-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginPropietario(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/propietario/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "conv-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "conv-e2e-refresh-secret";
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

    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await propietarioRepo.delete({ codigo: "SC-CONV-1" });
    await propietarioRepo.delete({ codigo: "SC-CONV-2" });
    await adminRepo.save({
      usuario: ADMIN_USERNAME,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 4),
      estado: "activo",
      nombre: "Admin",
      apellido: "E2E",
      correo: null,
      telefono: null,
    });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    accessTokenAdmin = login.body.accessToken as string;

    const propietario1 = await propietarioRepo.save({
      usuario: "propietario-conv-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Conversa",
      correo: "propietario-conv-1@correo.com",
      telefono: "+59171160050",
      codigo: "SC-CONV-1",
      moneda: "BOB",
      estatus: "activo",
    });
    propietario1Id = propietario1.id;
    const propietario2 = await propietarioRepo.save({
      usuario: "propietario-conv-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Luis",
      apellido: "Conversa",
      correo: "propietario-conv-2@correo.com",
      telefono: "+59171160051",
      codigo: "SC-CONV-2",
      moneda: "BOB",
      estatus: "activo",
    });
    propietario2Id = propietario2.id;

    tokenPropietario1 = await loginPropietario("propietario-conv-1");
    tokenPropietario2 = await loginPropietario("propietario-conv-2");
  });

  afterAll(async () => {
    // El borrado del propietario cascadea a conversaciones_propietario y mensajes_propietario.
    await propietarioRepo.delete({ id: propietario1Id });
    await propietarioRepo.delete({ id: propietario2Id });
    await propietarioRepo.delete({ codigo: "SC-CONV-1" });
    await propietarioRepo.delete({ codigo: "SC-CONV-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /conversaciones-propietario (admin) lista propietarios con waMe", async () => {
    const res = await request(app.getHttpServer())
      .get("/conversaciones-propietario")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const convPropietario1 = res.body.find((c: { propietario: { id: number } }) => c.propietario.id === propietario1Id);
    expect(convPropietario1.waMe).toBe("https://wa.me/59171160050");
  });

  it("GET /conversaciones-propietario como propietario -> 403 (admin-only)", async () => {
    const res = await request(app.getHttpServer())
      .get("/conversaciones-propietario")
      .set("Authorization", `Bearer ${tokenPropietario1}`);

    expect(res.status).toBe(403);
  });

  it("POST /conversaciones-propietario/:propietarioId/mensajes (admin) persiste emisor admin y aparece en el historial", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-propietario/${propietario1Id}/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "Hola, por favor regulariza tu cobro" });

    expect(res.status).toBe(201);
    expect(res.body.emisor).toBe("admin");
    expect(res.body.tipo).toBe("manual");

    const historial = await request(app.getHttpServer())
      .get(`/conversaciones-propietario/${propietario1Id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);
    expect(historial.status).toBe(200);
    expect(historial.body.mensajes.some((m: { contenido: string }) => m.contenido.includes("regulariza"))).toBe(true);
    expect(historial.body.waMe).toBe("https://wa.me/59171160050");
  });

  it("POST /conversaciones-propietario/:propietarioId/mensajes (propietario) responde en su propia conversación", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-propietario/${propietario1Id}/mensajes`)
      .set("Authorization", `Bearer ${tokenPropietario1}`)
      .send({ contenido: "Pago mañana sin falta" });

    expect(res.status).toBe(201);
    expect(res.body.emisor).toBe("propietario");
  });

  it("un propietario ve su propia conversación", async () => {
    const res = await request(app.getHttpServer())
      .get(`/conversaciones-propietario/${propietario1Id}`)
      .set("Authorization", `Bearer ${tokenPropietario1}`);

    expect(res.status).toBe(200);
    expect(res.body.propietario.id).toBe(propietario1Id);
    expect(res.body.mensajes.length).toBeGreaterThanOrEqual(2);
  });

  it("un propietario no ve la conversación de otro propietario -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/conversaciones-propietario/${propietario1Id}`)
      .set("Authorization", `Bearer ${tokenPropietario2}`);

    expect(res.status).toBe(403);
  });

  it("un propietario no envía mensajes en conversación ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-propietario/${propietario1Id}/mensajes`)
      .set("Authorization", `Bearer ${tokenPropietario2}`)
      .send({ contenido: "Hola" });

    expect(res.status).toBe(403);
  });

  it("POST con contenido vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-propietario/${propietario1Id}/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "" });

    expect(res.status).toBe(400);
  });

  it("POST con contenido de solo espacios -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-propietario/${propietario1Id}/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "   " });

    expect(res.status).toBe(400);
  });
});