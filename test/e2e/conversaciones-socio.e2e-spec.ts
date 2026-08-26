import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Socio } from "../../src/modules/socios/socio.entity";

describe("Conversaciones Admin↔Socio (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let accessTokenAdmin: string;
  let tokenSocio1: string;
  let tokenSocio2: string;
  let socio1Id: number;
  let socio2Id: number;

  const ADMIN_USERNAME = "conv-e2e-admin";
  const ADMIN_PASSWORD = "conv-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
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
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));

    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await socioRepo.delete({ codigo: "SC-CONV-1" });
    await socioRepo.delete({ codigo: "SC-CONV-2" });
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

    const socio1 = await socioRepo.save({
      usuario: "socio-conv-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Ana",
      apellido: "Conversa",
      correo: "socio-conv-1@correo.com",
      telefono: "+59171160050",
      codigo: "SC-CONV-1",
      moneda: "BOB",
      estatus: "activo",
    });
    socio1Id = socio1.id;
    const socio2 = await socioRepo.save({
      usuario: "socio-conv-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "Luis",
      apellido: "Conversa",
      correo: "socio-conv-2@correo.com",
      telefono: "+59171160051",
      codigo: "SC-CONV-2",
      moneda: "BOB",
      estatus: "activo",
    });
    socio2Id = socio2.id;

    tokenSocio1 = await loginSocio("socio-conv-1");
    tokenSocio2 = await loginSocio("socio-conv-2");
  });

  afterAll(async () => {
    // El borrado del socio cascadea a conversaciones_socio y mensajes_socio.
    await socioRepo.delete({ id: socio1Id });
    await socioRepo.delete({ id: socio2Id });
    await socioRepo.delete({ codigo: "SC-CONV-1" });
    await socioRepo.delete({ codigo: "SC-CONV-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("GET /conversaciones-socio (admin) lista socios con waMe", async () => {
    const res = await request(app.getHttpServer())
      .get("/conversaciones-socio")
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    const convSocio1 = res.body.find((c: { socio: { id: number } }) => c.socio.id === socio1Id);
    expect(convSocio1.waMe).toBe("https://wa.me/59171160050");
  });

  it("GET /conversaciones-socio como socio -> 403 (admin-only)", async () => {
    const res = await request(app.getHttpServer())
      .get("/conversaciones-socio")
      .set("Authorization", `Bearer ${tokenSocio1}`);

    expect(res.status).toBe(403);
  });

  it("POST /conversaciones-socio/:socioId/mensajes (admin) persiste emisor admin y aparece en el historial", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-socio/${socio1Id}/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "Hola, por favor regulariza tu cobro" });

    expect(res.status).toBe(201);
    expect(res.body.emisor).toBe("admin");
    expect(res.body.tipo).toBe("manual");

    const historial = await request(app.getHttpServer())
      .get(`/conversaciones-socio/${socio1Id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);
    expect(historial.status).toBe(200);
    expect(historial.body.mensajes.some((m: { contenido: string }) => m.contenido.includes("regulariza"))).toBe(true);
    expect(historial.body.waMe).toBe("https://wa.me/59171160050");
  });

  it("POST /conversaciones-socio/:socioId/mensajes (socio) responde en su propia conversación", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-socio/${socio1Id}/mensajes`)
      .set("Authorization", `Bearer ${tokenSocio1}`)
      .send({ contenido: "Pago mañana sin falta" });

    expect(res.status).toBe(201);
    expect(res.body.emisor).toBe("socio");
  });

  it("un socio ve su propia conversación", async () => {
    const res = await request(app.getHttpServer())
      .get(`/conversaciones-socio/${socio1Id}`)
      .set("Authorization", `Bearer ${tokenSocio1}`);

    expect(res.status).toBe(200);
    expect(res.body.socio.id).toBe(socio1Id);
    expect(res.body.mensajes.length).toBeGreaterThanOrEqual(2);
  });

  it("un socio no ve la conversación de otro socio -> 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/conversaciones-socio/${socio1Id}`)
      .set("Authorization", `Bearer ${tokenSocio2}`);

    expect(res.status).toBe(403);
  });

  it("un socio no envía mensajes en conversación ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-socio/${socio1Id}/mensajes`)
      .set("Authorization", `Bearer ${tokenSocio2}`)
      .send({ contenido: "Hola" });

    expect(res.status).toBe(403);
  });

  it("POST con contenido vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-socio/${socio1Id}/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "" });

    expect(res.status).toBe(400);
  });

  it("POST con contenido de solo espacios -> 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/conversaciones-socio/${socio1Id}/mensajes`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ contenido: "   " });

    expect(res.status).toBe(400);
  });
});