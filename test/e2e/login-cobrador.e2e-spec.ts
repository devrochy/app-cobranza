import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { DeepPartial, Repository } from "typeorm";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Login cobrador (e2e)", () => {
  let app: INestApplication;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;

  const PASSWORD = "e2e-password";
  const socioPayload: DeepPartial<Socio> = {
    usuario: "socio-login-cobrador",
    nombre: "Juan",
    apellido: "Pérez",
    correo: "login-cobrador@correo.com",
    telefono: "+59179999998",
    codigo: "SC-LC-001",
    moneda: "BOB",
    estatus: "activo",
  };
  const cobradorPayload: DeepPartial<Cobrador> = {
    usuario: "cobrador-login-e2e",
    nombre: "Carlos",
    apellido: "López",
    correo: "cobrador-login@correo.com",
    telefono: "+59171111110",
    codigo: "CB-LC-001",
    estatus: "activo",
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "login-cobrador-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "login-cobrador-e2e-refresh-secret";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));

    await cobradorRepo.delete({ usuario: cobradorPayload.usuario });
    await socioRepo.delete({ usuario: socioPayload.usuario });

    const hash = await bcrypt.hash(PASSWORD, 4);
    const socio = await socioRepo.save({ ...socioPayload, passwordHash: hash });
    await cobradorRepo.save({
      ...cobradorPayload,
      passwordHash: hash,
      socio: { id: socio.id } as Socio,
    });
  });

  afterAll(async () => {
    await cobradorRepo.delete({ usuario: cobradorPayload.usuario });
    await socioRepo.delete({ usuario: socioPayload.usuario });
    await app.close();
  });

  function decodeAccessToken(token: string): Record<string, unknown> {
    const jwt = new JwtService();
    return jwt.verify(token, { secret: process.env.JWT_SECRET });
  }

  it("POST /auth/cobrador/login -> 201 con tokens rol cobrador y datos del cobrador", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/cobrador/login")
      .send({ usuario: cobradorPayload.usuario, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.cobrador.usuario).toBe(cobradorPayload.usuario);
    expect(res.body.cobrador.passwordHash).toBeUndefined();

    const payload = decodeAccessToken(res.body.accessToken as string);
    expect(payload.rol).toBe("cobrador");
    expect(payload.usuario).toBe(cobradorPayload.usuario);
  });

  it("POST /auth/cobrador/login con contraseña incorrecta -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/cobrador/login")
      .send({ usuario: cobradorPayload.usuario, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("POST /auth/cobrador/login sin password -> 400 (validación de DTO)", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/cobrador/login")
      .send({ usuario: cobradorPayload.usuario });

    expect(res.status).toBe(400);
  });

  it("POST /auth/refresh rota el par de tokens de un cobrador y preserva el rol", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/cobrador/login")
      .send({ usuario: cobradorPayload.usuario, password: PASSWORD });
    const refreshToken = login.body.refreshToken as string;

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);

    const payload = decodeAccessToken(res.body.accessToken as string);
    expect(payload.rol).toBe("cobrador");
  });

  it("POST /whatsapp/simulado/recibir -> 403 para un cobrador autenticado (admin-only)", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/cobrador/login")
      .send({ usuario: cobradorPayload.usuario, password: PASSWORD });

    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ conversacionId: 1, contenido: "hola" });

    expect(res.status).toBe(403);
  });

  it("POST /auth/refresh rechaza a un cobrador bloqueado (revalidación de estado)", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/cobrador/login")
      .send({ usuario: cobradorPayload.usuario, password: PASSWORD });
    const refreshToken = login.body.refreshToken as string;

    await cobradorRepo.update(
      { usuario: cobradorPayload.usuario },
      { estatus: "bloqueado" },
    );

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });
});