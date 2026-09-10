import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Auto-actualización de perfil (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;

  const ADMIN_USUARIO = "perfil-e2e-admin";
  const ADMIN_PASSWORD = "Admin#Perfil2026";
  const SOCIO_USUARIO = "perfil-e2e-socio";
  const COBRADOR_USUARIO = "perfil-e2e-cobrador";
  const PASSWORD = "Pass#Perfil2026";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-perfil";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-perfil";
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

    await cobradorRepo.delete({ usuario: COBRADOR_USUARIO });
    await socioRepo.delete({ usuario: SOCIO_USUARIO });
    await adminRepo.delete({ usuario: ADMIN_USUARIO });

    await adminRepo.save({
      usuario: ADMIN_USUARIO,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 4),
      estado: "activo",
      nombre: "Admin",
      apellido: "E2E",
      correo: null,
      telefono: null,
    });

    const socio = await socioRepo.save({
      usuario: SOCIO_USUARIO,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "perfil-e2e-socio@correo.com",
      telefono: "+59171160180",
      codigo: "SC-PERFIL-1",
      moneda: "BOB",
      estatus: "activo",
    });

    await cobradorRepo.save({
      socio: { id: socio.id } as Socio,
      usuario: COBRADOR_USUARIO,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "perfil-e2e-cobrador@correo.com",
      telefono: "+59171160181",
      codigo: "CB-PERFIL-1",
      estatus: "activo",
    });
  });

  afterAll(async () => {
    await cobradorRepo.delete({ usuario: COBRADOR_USUARIO });
    await socioRepo.delete({ usuario: SOCIO_USUARIO });
    await adminRepo.delete({ usuario: ADMIN_USUARIO });
    await app.close();
  });

  async function tokenDe(
    rol: "cobrador" | "socio" | "admin",
  ): Promise<string> {
    const path =
      rol === "admin"
        ? "/auth/login"
        : rol === "socio"
          ? "/auth/socio/login"
          : "/auth/cobrador/login";
    const usuario =
      rol === "admin" ? ADMIN_USUARIO : rol === "socio" ? SOCIO_USUARIO : COBRADOR_USUARIO;
    const password = rol === "admin" ? ADMIN_PASSWORD : PASSWORD;
    const res = await request(app.getHttpServer())
      .post(path)
      .send({ usuario, password });
    return res.body.accessToken as string;
  }

  it("PATCH /perfil actualiza el perfil del cobrador", async () => {
    const token = await tokenDe("cobrador");

    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Nuevo", apellido: "Cobrador" });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toBe(COBRADOR_USUARIO);
    expect(res.body.nombre).toBe("Nuevo");
    expect(res.body.apellido).toBe("Cobrador");

    const enDb = await cobradorRepo.findOne({ where: { usuario: COBRADOR_USUARIO } });
    expect(enDb?.nombre).toBe("Nuevo");
  });

  it("PATCH /perfil actualiza el perfil del socio", async () => {
    const token = await tokenDe("socio");

    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Ana", apellido: "Socio" });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toBe(SOCIO_USUARIO);
    expect(res.body.nombre).toBe("Ana");

    const enDb = await socioRepo.findOne({ where: { usuario: SOCIO_USUARIO } });
    expect(enDb?.apellido).toBe("Socio");
  });

  it("PATCH /perfil sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .send({ nombre: "x", apellido: "y" });

    expect(res.status).toBe(401);
  });

  it("PATCH /perfil sin nombre -> 400", async () => {
    const token = await tokenDe("cobrador");

    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", `Bearer ${token}`)
      .send({ apellido: "solo-apellido" });

    expect(res.status).toBe(400);
  });

  it("un admin no puede usar /perfil -> 403", async () => {
    const token = await tokenDe("admin");

    const res = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "x", apellido: "y" });

    expect(res.status).toBe(403);
  });
});
