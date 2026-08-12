import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { Repository } from "typeorm";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Inyeccion } from "../../src/modules/rutas/inyeccion.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";
import { AppModule } from "../../src/app.module";

describe("Eliminación de inyecciones (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let inyRepo: Repository<Inyeccion>;
  let accessTokenAdmin: string;
  let tokenSocio: string;
  let rutaPropiaId: number;
  let rutaAjenaId: number;
  let inyeccionId: number;
  let inyeccion2Id: number;

  const ADMIN_USERNAME = "del-iny-e2e-admin";
  const ADMIN_PASSWORD = "del-iny-e2e-password";
  const PASSWORD = "password-seguro";

  async function loginSocio(usuario: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/socio/login")
      .send({ usuario, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "del-iny-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "del-iny-e2e-refresh-secret";
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
    inyRepo = moduleFixture.get(getRepositoryToken(Inyeccion));

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
      usuario: "socio-del-iny-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-del-iny-1@correo.com",
      telefono: "+59171150001",
      codigo: "SC-DEL-INY-1",
      moneda: "BOB",
      estatus: "activo",
    });
    const socio2 = await socioRepo.save({
      usuario: "socio-del-iny-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-del-iny-2@correo.com",
      telefono: "+59171150002",
      codigo: "SC-DEL-INY-2",
      moneda: "BOB",
      estatus: "activo",
    });

    await request(app.getHttpServer())
      .put(`/socios/${socio.id}/permisos`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ matriz: { configurar_ruta: true, eliminar_inyeccion: true } });

    const cobrador = await cobradorRepo.save({
      socio: { id: socio.id },
      usuario: "cobrador-del-iny-1",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-del-iny-1@correo.com",
      telefono: "+59172260001",
      codigo: "CB-DEL-INY-1",
      estatus: "activo",
    });
    const cobrador2 = await cobradorRepo.save({
      socio: { id: socio2.id },
      usuario: "cobrador-del-iny-2",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-del-iny-2@correo.com",
      telefono: "+59172260002",
      codigo: "CB-DEL-INY-2",
      estatus: "activo",
    });

    const rutaPropia = await rutaRepo.save({
      socio: { id: socio.id },
      cobrador: { id: cobrador.id },
      nombre: "Ruta DEL-INY-1",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaPropiaId = rutaPropia.id;

    const rutaAjena = await rutaRepo.save({
      socio: { id: socio2.id },
      cobrador: { id: cobrador2.id },
      nombre: "Ruta DEL-INY-2",
      descripcion: null,
      tipoInteres: 25,
      numCuotas: 10,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaAjenaId = rutaAjena.id;

    const iny = await request(app.getHttpServer())
      .post(`/rutas/${rutaPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 1500, comentario: "Aporte a eliminar" });
    inyeccionId = iny.body.id as number;

    const iny2 = await request(app.getHttpServer())
      .post(`/rutas/${rutaPropiaId}/inyecciones`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ valor: 300, comentario: "Otra inyección" });
    inyeccion2Id = iny2.body.id as number;

    tokenSocio = await loginSocio("socio-del-iny-1");
  });

  afterAll(async () => {
    await inyRepo.delete({ id: inyeccionId });
    await inyRepo.delete({ id: inyeccion2Id });
    await rutaRepo.delete({ id: rutaPropiaId });
    await rutaRepo.delete({ id: rutaAjenaId });
    await cobradorRepo.delete({ codigo: "CB-DEL-INY-1" });
    await cobradorRepo.delete({ codigo: "CB-DEL-INY-2" });
    await socioRepo.delete({ codigo: "SC-DEL-INY-1" });
    await socioRepo.delete({ codigo: "SC-DEL-INY-2" });
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("DELETE /rutas/:id/inyecciones/:id -> 200 estado eliminada y el registro persiste con su fecha_hora", async () => {
    const antes = await inyRepo.findOne({ where: { id: inyeccionId } });

    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaPropiaId}/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("eliminada");

    const persistido = await inyRepo.findOne({ where: { id: inyeccionId } });
    expect(persistido).toBeDefined();
    expect(persistido?.estado).toBe("eliminada");
    expect(persistido?.fechaHora).toEqual(antes?.fechaHora);
  });

  // Depende del test anterior: re-elimina la misma inyección ya eliminada.
  it("DELETE es idempotente (re-eliminar ya eliminada -> 200)", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaPropiaId}/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("eliminada");
  });

  it("un socio sin eliminar_inyeccion no puede eliminar -> 403", async () => {
    const socioSinPermiso = await socioRepo.save({
      usuario: "socio-del-iny-3",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      nombre: "S",
      apellido: "E2E",
      correo: "socio-del-iny-3@correo.com",
      telefono: "+59171150003",
      codigo: "SC-DEL-INY-3",
      moneda: "BOB",
      estatus: "activo",
    });
    const token = await loginSocio("socio-del-iny-3");

    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaPropiaId}/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    await socioRepo.delete({ id: socioSinPermiso.id });
  });

  it("DELETE de una inyección que pertenece a otra ruta -> 404 (doble filtro)", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaAjenaId}/inyecciones/${inyeccion2Id}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("un socio con eliminar_inyeccion elimina en su propia ruta -> 200", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaPropiaId}/inyecciones/${inyeccion2Id}`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("eliminada");
  });

  it("un socio no puede eliminar una inyección de una ruta ajena -> 403", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaAjenaId}/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${tokenSocio}`);

    expect(res.status).toBe(403);
  });

  it("DELETE de una inyección inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/rutas/${rutaPropiaId}/inyecciones/999999`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("DELETE de una ruta inexistente -> 404", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/rutas/999999/inyecciones/${inyeccionId}`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it("DELETE sin token -> 401", async () => {
    const res = await request(app.getHttpServer()).delete(
      `/rutas/${rutaPropiaId}/inyecciones/${inyeccionId}`,
    );

    expect(res.status).toBe(401);
  });
});
