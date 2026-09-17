import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { DeepPartial, Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AdminUser } from "../../src/modules/admin-users/admin-user.entity";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { CobroPropietario } from "../../src/modules/cobros-propietario/cobro-propietario.entity";
import { ConversacionPropietario } from "../../src/modules/cobros-propietario/conversacion-propietario.entity";
import { LinkPago } from "../../src/modules/cobros-propietario/link-pago.entity";
import { MensajePropietario } from "../../src/modules/cobros-propietario/mensaje-propietario.entity";
import { PropietarioMoraService } from "../../src/modules/cobros-propietario/propietario-mora.service";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";

describe("Bloqueo automático por mora de cobro (e2e)", () => {
  let app: INestApplication;
  let adminRepo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let carteraRepo: Repository<Cartera>;
  let cobroRepo: Repository<CobroPropietario>;
  let linkRepo: Repository<LinkPago>;
  let conversacionRepo: Repository<ConversacionPropietario>;
  let mensajeRepo: Repository<MensajePropietario>;
  let propietarioMora: PropietarioMoraService;
  let accessTokenAdmin: string;

  const ADMIN_USERNAME = "mora-e2e-admin";
  const ADMIN_PASSWORD = "mora-e2e-password";
  const HOY = new Date("2026-08-26T00:00:00Z");

  let propietarioAId: number;
  let gestorAId: number;
  let carteraAId: number;
  let cobroAId: number;

  let propietarioBId: number;
  let gestorBId: number;
  let carteraBId: number;
  let cobroB1Id: number;
  let cobroB2Id: number;

  async function limpiarPropietario(propietarioId: number): Promise<void> {
    const conversaciones = await conversacionRepo.find({ where: { propietario: { id: propietarioId } } });
    for (const conversacion of conversaciones) {
      await mensajeRepo.delete({ conversacion: { id: conversacion.id } });
    }
    await conversacionRepo.delete({ propietario: { id: propietarioId } });
    const cobros = await cobroRepo.find({ where: { propietario: { id: propietarioId } } });
    for (const cobro of cobros) {
      await linkRepo.delete({ cobroPropietario: { id: cobro.id } });
    }
    await cobroRepo.delete({ propietario: { id: propietarioId } });
    await carteraRepo.delete({ propietario: { id: propietarioId } });
    await gestorRepo.delete({ propietario: { id: propietarioId } });
    await propietarioRepo.delete({ id: propietarioId });
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
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    cobroRepo = moduleFixture.get(getRepositoryToken(CobroPropietario));
    linkRepo = moduleFixture.get(getRepositoryToken(LinkPago));
    conversacionRepo = moduleFixture.get(getRepositoryToken(ConversacionPropietario));
    mensajeRepo = moduleFixture.get(getRepositoryToken(MensajePropietario));
    propietarioMora = moduleFixture.get(PropietarioMoraService);

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

    // Propietario A: un solo cobro vencido (para bloqueo + re-habilitación).
    const propietarioA = await propietarioRepo.save({
      usuario: "propietario-mora-a",
      passwordHash: await bcrypt.hash("x", 4),
      nombre: "Ana",
      apellido: "MoraA",
      correo: "propietario-mora-a@correo.com",
      telefono: "+59171160040",
      codigo: "SC-MORA-A",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioAId = propietarioA.id;
    const gestorA = await gestorRepo.save({
      propietario: { id: propietarioAId },
      usuario: "gestor-mora-a",
      passwordHash: await bcrypt.hash("x", 4),
      nombre: "Carlos",
      apellido: "MoraA",
      correo: "gestor-mora-a@correo.com",
      telefono: "+59172260040",
      codigo: "CB-MORA-A",
      estatus: "activo",
    });
    gestorAId = gestorA.id;
    const carteraA = await carteraRepo.save({
      propietario: { id: propietarioAId },
      gestor: { id: gestorAId },
      nombre: "Cartera MORA-A",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      costoCobro: 250,
      estatus: "activo",
    });
    carteraAId = carteraA.id;
    const cobroA = await cobroRepo.save({
      propietario: { id: propietarioAId },
      propietarioId: propietarioAId,
      periodo: "2026-07",
      montoCalculado: 250,
      montoPagado: null,
      fechaVencimiento: "2026-07-20",
      fechaPago: null,
      estado: "pendiente",
      metodoPago: null,
      registradoPor: null,
    } as DeepPartial<CobroPropietario>);
    cobroAId = cobroA.id;

    // Propietario B: dos cobros vencidos (para verificar que un pago parcial no re-habilita).
    const propietarioB = await propietarioRepo.save({
      usuario: "propietario-mora-b",
      passwordHash: await bcrypt.hash("x", 4),
      nombre: "Luis",
      apellido: "MoraB",
      correo: "propietario-mora-b@correo.com",
      telefono: "+59171160041",
      codigo: "SC-MORA-B",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioBId = propietarioB.id;
    const gestorB = await gestorRepo.save({
      propietario: { id: propietarioBId },
      usuario: "gestor-mora-b",
      passwordHash: await bcrypt.hash("x", 4),
      nombre: "Rosa",
      apellido: "MoraB",
      correo: "gestor-mora-b@correo.com",
      telefono: "+59172260041",
      codigo: "CB-MORA-B",
      estatus: "activo",
    });
    gestorBId = gestorB.id;
    const carteraB = await carteraRepo.save({
      propietario: { id: propietarioBId },
      gestor: { id: gestorBId },
      nombre: "Cartera MORA-B",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      costoCobro: 300,
      estatus: "activo",
    });
    carteraBId = carteraB.id;
    const cobroB1 = await cobroRepo.save({
      propietario: { id: propietarioBId },
      propietarioId: propietarioBId,
      periodo: "2026-06",
      montoCalculado: 300,
      montoPagado: null,
      fechaVencimiento: "2026-06-20",
      fechaPago: null,
      estado: "pendiente",
      metodoPago: null,
      registradoPor: null,
    } as DeepPartial<CobroPropietario>);
    cobroB1Id = cobroB1.id;
    const cobroB2 = await cobroRepo.save({
      propietario: { id: propietarioBId },
      propietarioId: propietarioBId,
      periodo: "2026-07",
      montoCalculado: 300,
      montoPagado: null,
      fechaVencimiento: "2026-07-20",
      fechaPago: null,
      estado: "pendiente",
      metodoPago: null,
      registradoPor: null,
    } as DeepPartial<CobroPropietario>);
    cobroB2Id = cobroB2.id;
  });

  afterAll(async () => {
    await limpiarPropietario(propietarioAId);
    await limpiarPropietario(propietarioBId);
    await adminRepo.delete({ usuario: ADMIN_USERNAME });
    await app.close();
  });

  it("bloquea al propietario con cobro vencido más allá de la tolerancia y cascada a gestor/cartera", async () => {
    const bloqueados = await propietarioMora.bloquearMorosos(HOY);

    expect(bloqueados).toBeGreaterThanOrEqual(1);

    const propietarioA = await propietarioRepo.findOne({ where: { id: propietarioAId } });
    expect(propietarioA?.estatus).toBe("bloqueado");
    const gestorA = await gestorRepo.findOne({ where: { id: gestorAId } });
    expect(gestorA?.estatus).toBe("bloqueado");
    const carteraA = await carteraRepo.findOne({ where: { id: carteraAId } });
    expect(carteraA?.estatus).toBe("bloqueado");
  });

  it("re-habilita al propietario al pagar su cobro si ya no queda morosidad", async () => {
    const res = await request(app.getHttpServer())
      .post(`/cobros-propietario/${cobroAId}/pago`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ montoPagado: 250, metodoPago: "transferencia" });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("pagado");

    const propietarioA = await propietarioRepo.findOne({ where: { id: propietarioAId } });
    expect(propietarioA?.estatus).toBe("activo");
    const gestorA = await gestorRepo.findOne({ where: { id: gestorAId } });
    expect(gestorA?.estatus).toBe("activo");
    const carteraA = await carteraRepo.findOne({ where: { id: carteraAId } });
    expect(carteraA?.estatus).toBe("activo");
  });

  it("no re-habilita al propietario si queda otro cobro moroso sin pagar", async () => {
    await propietarioMora.bloquearMorosos(HOY);

    const res = await request(app.getHttpServer())
      .post(`/cobros-propietario/${cobroB2Id}/pago`)
      .set("Authorization", `Bearer ${accessTokenAdmin}`)
      .send({ montoPagado: 300, metodoPago: "transferencia" });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("pagado");

    const propietarioB = await propietarioRepo.findOne({ where: { id: propietarioBId } });
    expect(propietarioB?.estatus).toBe("bloqueado");
    const cobroB1 = await cobroRepo.findOne({ where: { id: cobroB1Id } });
    expect(cobroB1?.estado).toBe("pendiente");
    const carteraB = await carteraRepo.findOne({ where: { id: carteraBId } });
    expect(carteraB?.estatus).toBe("bloqueado");
  });
});