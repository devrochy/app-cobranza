import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { DeepPartial, Repository } from "typeorm";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";
import { AppModule } from "../../src/app.module";

describe("Login gestor (e2e)", () => {
  let app: INestApplication;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;

  const PASSWORD = "e2e-password";
  const propietarioPayload: DeepPartial<Propietario> = {
    usuario: "propietario-login-gestor",
    nombre: "Juan",
    apellido: "Pérez",
    correo: "login-gestor@correo.com",
    telefono: "+59179999998",
    codigo: "SC-LC-001",
    moneda: "BOB",
    estatus: "activo",
  };
  const gestorPayload: DeepPartial<Gestor> = {
    usuario: "gestor-login-e2e",
    nombre: "Carlos",
    apellido: "López",
    correo: "gestor-login@correo.com",
    telefono: "+59171111110",
    codigo: "CB-LC-001",
    estatus: "activo",
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "login-gestor-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "login-gestor-e2e-refresh-secret";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));

    await gestorRepo.delete({ usuario: gestorPayload.usuario });
    await propietarioRepo.delete({ usuario: propietarioPayload.usuario });

    const hash = await bcrypt.hash(PASSWORD, 4);
    const propietario = await propietarioRepo.save({ ...propietarioPayload, passwordHash: hash });
    await gestorRepo.save({
      ...gestorPayload,
      passwordHash: hash,
      propietario: { id: propietario.id } as Propietario,
    });
  });

  afterAll(async () => {
    await gestorRepo.delete({ usuario: gestorPayload.usuario });
    await propietarioRepo.delete({ usuario: propietarioPayload.usuario });
    await app.close();
  });

  function decodeAccessToken(token: string): Record<string, unknown> {
    const jwt = new JwtService();
    return jwt.verify(token, { secret: process.env.JWT_SECRET });
  }

  it("POST /auth/gestor/login -> 201 con tokens rol gestor y datos del gestor", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario: gestorPayload.usuario, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.gestor.usuario).toBe(gestorPayload.usuario);
    expect(res.body.gestor.passwordHash).toBeUndefined();

    const payload = decodeAccessToken(res.body.accessToken as string);
    expect(payload.rol).toBe("gestor");
    expect(payload.usuario).toBe(gestorPayload.usuario);
  });

  it("POST /auth/gestor/login con contraseña incorrecta -> 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario: gestorPayload.usuario, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("POST /auth/gestor/login sin password -> 400 (validación de DTO)", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario: gestorPayload.usuario });

    expect(res.status).toBe(400);
  });

  it("POST /auth/refresh rota el par de tokens de un gestor y preserva el rol", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario: gestorPayload.usuario, password: PASSWORD });
    const refreshToken = login.body.refreshToken as string;

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);

    const payload = decodeAccessToken(res.body.accessToken as string);
    expect(payload.rol).toBe("gestor");
  });

  it("POST /whatsapp/simulado/recibir -> 403 para un gestor autenticado (admin-only)", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario: gestorPayload.usuario, password: PASSWORD });

    const res = await request(app.getHttpServer())
      .post("/whatsapp/simulado/recibir")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ conversacionId: 1, contenido: "hola" });

    expect(res.status).toBe(403);
  });

  it("POST /auth/refresh rechaza a un gestor bloqueado (revalidación de estado)", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/gestor/login")
      .send({ usuario: gestorPayload.usuario, password: PASSWORD });
    const refreshToken = login.body.refreshToken as string;

    await gestorRepo.update(
      { usuario: gestorPayload.usuario },
      { estatus: "bloqueado" },
    );

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });
});