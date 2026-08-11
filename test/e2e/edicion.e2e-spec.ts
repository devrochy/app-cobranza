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

describe("Edición de socio y cobrador (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let accessToken: string;
  let socioId: number;
  let socio2Id: number;
  let cobradorId: number;

  const ADMIN_USERNAME = "edicion-e2e-admin";
  const ADMIN_PASSWORD = "edicion-e2e-password";

  beforeAll(async () => {
    process.env.JWT_SECRET = "edicion-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "edicion-e2e-refresh-secret";
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

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ usuario: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    accessToken = login.body.accessToken as string;

    const socio = await socioRepo.save({
      usuario: "socio-ed-1",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "Juan",
      apellido: "Pérez",
      correo: "socio-ed1@correo.com",
      telefono: "+59172222221",
      codigo: "SC-ED-001",
      moneda: "BOB",
      estatus: "activo",
    });
    socioId = socio.id;

    const socio2 = await socioRepo.save({
      usuario: "socio-ed-2",
      passwordHash: await bcrypt.hash("password-seguro", 4),
      nombre: "María",
      apellido: "Gómez",
      correo: "socio-ed2@correo.com",
      telefono: "+59172222222",
      codigo: "SC-ED-002",
      moneda: "BOB",
      estatus: "activo",
    });
    socio2Id = socio2.id;

    const cobrador = await request(app.getHttpServer())
      .post("/cobradores")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        socioId,
        usuario: "cobrador-ed",
        password: "password-seguro",
        nombre: "Carlos",
        apellido: "López",
        correo: "cobrador-ed@correo.com",
        telefono: "+59173333333",
        codigo: "CB-ED-001",
      });
    cobradorId = cobrador.body.id as number;
  });

  afterAll(async () => {
    await cobradorRepo.delete({ id: cobradorId });
    await socioRepo.delete({ id: socioId });
    await socioRepo.delete({ id: socio2Id });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("PATCH /socios/:id -> 200 actualiza perfil sin passwordHash", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombre: "Juan Carlos", apellido: "Pérez Soto" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Juan Carlos");
    expect(res.body.apellido).toBe("Pérez Soto");
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  it("PATCH /socios/:id con nueva contraseña -> 200 sin exponer hash y con hash persistido", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: "nueva-password" });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).not.toContain("passwordHash");

    const persisted = await socioRepo
      .createQueryBuilder("s")
      .addSelect("s.passwordHash")
      .where("s.id = :id", { id: socioId })
      .getOne();
    expect(persisted).toBeDefined();
    expect(await bcrypt.compare("nueva-password", persisted!.passwordHash)).toBe(true);
  });

  it("PATCH /socios/:id con correo de otro socio -> 409", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ correo: "socio-ed2@correo.com" });

    expect(res.status).toBe(409);
  });

  it("PATCH /socios/:id con campo no editable -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ usuario: "nuevo-usuario" });

    expect(res.status).toBe(400);
  });

  it("PATCH /socios/:id con body vacío -> 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("PATCH /socios/:id inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/999999`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(404);
  });

  it("PATCH /cobradores/:id -> 200 actualiza sin passwordHash", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cobradores/${cobradorId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombre: "Carlos Eduardo" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Carlos Eduardo");
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  it("PATCH /cobradores/:id inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cobradores/999999`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(404);
  });

  it("PATCH /socios/:id sin token -> 401", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/socios/${socioId}`)
      .send({ nombre: "X" });

    expect(res.status).toBe(401);
  });
});
