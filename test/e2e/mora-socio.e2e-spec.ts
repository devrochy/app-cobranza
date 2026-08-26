import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { DeepPartial, Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { CobroSocio } from "../../src/modules/cobros-socio/cobro-socio.entity";
import { ConversacionSocio } from "../../src/modules/cobros-socio/conversacion-socio.entity";
import { LinkPago } from "../../src/modules/cobros-socio/link-pago.entity";
import { MensajeSocio } from "../../src/modules/cobros-socio/mensaje-socio.entity";
import { SocioMoraService } from "../../src/modules/cobros-socio/socio-mora.service";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";

describe("Bloqueo automático por mora de cobro (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let rutaRepo: Repository<Ruta>;
  let cobroRepo: Repository<CobroSocio>;
  let linkRepo: Repository<LinkPago>;
  let conversacionRepo: Repository<ConversacionSocio>;
  let mensajeRepo: Repository<MensajeSocio>;
  let socioMora: SocioMoraService;
  let accessTokenAdmin: string;

  const ADMIN_USERNAME = "mora-e2e-admin";
  const ADMIN_PASSWORD = "mora-e2e-password";
  const HOY = new Date("2026-08-26T00:00:00Z");

  let socioAId: number;
  let cobradorAId: number;
  let rutaAId: number;
  let cobroAId: number;

  let socioBId: number;
  let cobradorBId: number;
  let rutaBId: number;
  let cobroB1Id: number;
  let cobroB2Id: number;

  async function limpiarSocio(socioId: number): Promise<void> {
    const conversaciones = await conversacionRepo.find({ where: { socio: { id: socioId } } });
    for (const conversacion of conversaciones) {
      await mensajeRepo.delete({ conversacion: { id: conversacion.id } });
    }
    await conversacionRepo.delete({ socio: { id: socioId } });
    const cobros = await cobroRepo.find({ where: { socio: { id: socioId } } });
    for (const cobro of cobros) {
      await linkRepo.delete({ cobroSocio: { id: cobro.id } });
    }
    await cobroRepo.delete({ socio: { id: socioId } });
    await rutaRepo.delete({ socio: { id: socioId } });
    await cobradorRepo.delete({ socio: { id: socioId } });
    await socioRepo.delete({ id: socioId });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "mora-e2e-access-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_SECRET = "mora-e2e-refresh-secret";
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
    cobroRepo = moduleFixture.get(getRepositoryToken(CobroSocio));
    linkRepo = moduleFixture.get(getRepositoryToken(LinkPago));
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionSocio));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajeSocio));
    socioMora = moduleFixture.get(SocioMoraService);

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
    accessTokenAdmin = login.body.accessToken as string;

    // Socio A: un solo cobro vencido (para bloqueo + re-habilitación).
    const socioA = await socioRepo.save({
      usuario: "socio-mora-a",
      passwordHash: await bcrypt.hash("x", 4),
      nombre: "Ana",
      apellido: "MoraA",
      correo: "socio-mora-a@correo.com",
      telefono: "+59171160040",
      codigo: "SC-MORA-A",
      moneda: "BOB",
      estatus: "activo",
    });
    socioAId = socioA.id;
    const cobradorA = await cobradorRepo.save({
      socio: { id: socioAId },
      usuario: "cobrador-mora-a",
      passwordHash: await bcrypt.hash("x", 4),
      nombre: "Carlos",
      apellido: "MoraA",
      correo: "cobrador-mora-a@correo.com",
      telefono: "+59172260040",
      codigo: "CB-MORA-A",
      estatus: "activo",
    });
    cobradorAId = cobradorA.id;
    const rutaA = await rutaRepo.save({
      socio: { id: socioAId },
      cobrador: { id: cobradorAId },
      nombre: "Ruta MORA-A",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      costoCobro: 250,
      estatus: "activo",
    });
    rutaAId = rutaA.id;
    const cobroA = await cobroRepo.save({
      socio: { id: socioAId },
      socioId: socioAId,
      periodo: "2026-07",
      montoCalculado: 250,
      montoPagado: null,
      fechaVencimiento: "2026-07-20",
      fechaPago: null,
      estado: "pendiente",
      metodoPago: null,
      registradoPor: null,
    } as DeepPartial<CobroSocio>);
    cobroAId = cobroA.id;

    // Socio B: dos cobros vencidos (para verificar que un pago parcial no re-habilita).
    const socioB = await socioRepo.save({
      usuario: "socio-mora-b",
      passwordHash: await bcrypt.hash("x", 4),
      nombre: "Luis",
      apellido: "MoraB",
      correo: "socio-mora-b@correo.com",
      telefono: "+59171160041",
      codigo: "SC-MORA-B",
      moneda: "BOB",
      estatus: "activo",
    });
    socioBId = socioB.id;
    const cobradorB = await cobradorRepo.save({
      socio: { id: socioBId },
      usuario: "cobrador-mora-b",
      passwordHash: await bcrypt.hash("x", 4),
      nombre: "Rosa",
      apellido: "MoraB",
      correo: "cobrador-mora-b@correo.com",
      telefono: "+59172260041",
      codigo: "CB-MORA-B",
      estatus: "activo",
    });
    cobradorBId = cobradorB.id;
    const rutaB = await rutaRepo.save({
      socio: { id: socioBId },
      cobrador: { id: cobradorBId },
      nombre: "Ruta MORA-B",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      costoCobro: 300,
      estatus: "activo",
    });
    rutaBId = rutaB.id;
    const cobroB1 = await cobroRepo.save({
      socio: { id: socioBId },
      socioId: socioBId,
      periodo: "2026-06",
      montoCalculado: 300,
      montoPagado: null,
      fechaVencimiento: "2026-06-20",
      fechaPago: null,
      estado: "pendiente",
      metodoPago: null,
      registradoPor: null,
    } as DeepPartial<CobroSocio>);
    cobroB1Id = cobroB1.id;
    const cobroB2 = await cobroRepo.save({
      socio: { id: socioBId },
      socioId: socioBId,
      periodo: "2026-07",
      montoCalculado: 300,
      montoPagado: null,
      fechaVencimiento: "2026-07-20",
      fechaPago: null,
      estado: "pendiente",
      metodoPago: null,
      registradoPor: null,
    } as DeepPartial<CobroSocio>);
    cobroB2Id = cobroB2.id;
  });

  afterAll(async () => {
    await limpiarSocio(socioAId);
    await limpiarSocio(socioBId);
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("bloquea al socio con cobro vencido más allá de la tolerancia y cascada a cobrador/ruta", async () => {
    const bloqueados = await socioMora.bloquearMorosos(HOY);

    expect(bloqueados).toBeGreaterThanOrEqual(1);

    const socioA = await socioRepo.findOne({ where: { id: socioAId } });
    expect(socioA?.estatus).toBe("bloqueado");
    const cobradorA = await cobradorRepo.findOne({ where: { id: cobradorAId } });
    expect(cobradorA?.estatus).toBe("bloqueado");
    const rutaA = await rutaRepo.findOne({ where: { id: rutaAId } });
    expect(rutaA?.estatus).toBe("bloqueado");
  });

  it("re-habilita al socio al pagar su cobro si ya no queda morosidad", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobros-socio/${cobroAId}/pago`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ montoPagado: 250, metodoPago: "transferencia" });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("pagado");

    const socioA = await socioRepo.findOne({ where: { id: socioAId } });
    expect(socioA?.estatus).toBe("activo");
    const cobradorA = await cobradorRepo.findOne({ where: { id: cobradorAId } });
    expect(cobradorA?.estatus).toBe("activo");
    const rutaA = await rutaRepo.findOne({ where: { id: rutaAId } });
    expect(rutaA?.estatus).toBe("activo");
  });

  it("no re-habilita al socio si queda otro cobro moroso sin pagar", async () => {
    await socioMora.bloquearMorosos(HOY);

    const res = await request(app.getHttpServer())
      .post(`/cobros-socio/${cobroB2Id}/pago`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ montoPagado: 300, metodoPago: "transferencia" });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("pagado");

    const socioB = await socioRepo.findOne({ where: { id: socioBId } });
    expect(socioB?.estatus).toBe("bloqueado");
    const cobroB1 = await cobroRepo.findOne({ where: { id: cobroB1Id } });
    expect(cobroB1?.estado).toBe("pendiente");
    const rutaB = await rutaRepo.findOne({ where: { id: rutaBId } });
    expect(rutaB?.estatus).toBe("bloqueado");
  });
});