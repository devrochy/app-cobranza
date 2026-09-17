import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { Cuota } from "../../src/modules/clientes/cuota.entity";
import { Prestamo } from "../../src/modules/clientes/prestamo.entity";
import { Cliente } from "../../src/modules/clientes/cliente.entity";
import { MoraJobService } from "../../src/modules/clientes/mora-job.service";
import { Gestor } from "../../src/modules/gestores/gestor.entity";
import { Cartera } from "../../src/modules/carteras/cartera.entity";
import { Propietario } from "../../src/modules/propietarios/propietario.entity";

describe("Job de mora (e2e)", () => {
  let app: INestApplication;
  let cuotaRepo: Repository<Cuota>;
  let prestamoRepo: Repository<Prestamo>;
  let clienteRepo: Repository<Cliente>;
  let carteraRepo: Repository<Cartera>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;
  let moraJob: MoraJobService;
  let carteraId: number;
  let clienteId: number;
  let prestamoId: number;
  let propietarioId: number;
  let gestorId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    carteraRepo = moduleFixture.get(getRepositoryToken(Cartera));
    propietarioRepo = moduleFixture.get(getRepositoryToken(Propietario));
    gestorRepo = moduleFixture.get(getRepositoryToken(Gestor));
    moraJob = moduleFixture.get(MoraJobService);

    // Limpieza completa en orden de FK por si quedan datos residuales de corridas previas.
    await cuotaRepo
      .createQueryBuilder()
      .delete()
      .where(
        "prestamo_id IN (SELECT p.id FROM prestamos p JOIN clientes c ON c.id = p.cliente_id JOIN carteras r ON r.id = c.cartera_id WHERE r.nombre = :nombre)",
        { nombre: "Cartera MORA-E2E" },
      )
      .execute();
    await prestamoRepo
      .createQueryBuilder()
      .delete()
      .where(
        "cliente_id IN (SELECT c.id FROM clientes c JOIN carteras r ON r.id = c.cartera_id WHERE r.nombre = :nombre)",
        { nombre: "Cartera MORA-E2E" },
      )
      .execute();
    await clienteRepo
      .createQueryBuilder()
      .delete()
      .where(
        "cartera_id IN (SELECT r.id FROM carteras r WHERE r.nombre = :nombre)",
        { nombre: "Cartera MORA-E2E" },
      )
      .execute();
    await carteraRepo
      .createQueryBuilder()
      .delete()
      .where("nombre = :nombre", { nombre: "Cartera MORA-E2E" })
      .execute();
    await gestorRepo.delete({ codigo: "CB-MORA-E2E" });
    await propietarioRepo.delete({ codigo: "SC-MORA-E2E" });

    const propietario = await propietarioRepo.save({
      usuario: "propietario-mora-e2e",
      passwordHash: "x",
      nombre: "S",
      apellido: "E2E",
      correo: "propietario-mora-e2e@correo.com",
      telefono: "+59171160097",
      codigo: "SC-MORA-E2E",
      moneda: "BOB",
      estatus: "activo",
    });
    propietarioId = propietario.id;

    const gestor = await gestorRepo.save({
      propietario: { id: propietarioId } as Propietario,
      usuario: "gestor-mora-e2e",
      passwordHash: "x",
      nombre: "C",
      apellido: "E2E",
      correo: "gestor-mora-e2e@correo.com",
      telefono: "+59172270099",
      codigo: "CB-MORA-E2E",
      estatus: "activo",
    });
    gestorId = gestor.id;

    const cartera = await carteraRepo.save({
      propietario: { id: propietarioId } as Propietario,
      gestor: { id: gestorId } as Gestor,
      nombre: "Cartera MORA-E2E",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 4,
      moneda: "BOB",
      estatus: "activo",
    });
    carteraId = cartera.id;

    const cliente = await clienteRepo.save({
      cartera: { id: carteraId } as Cartera,
      carteraId,
      nombre: "Ana",
      apellido: "Mora",
      negocio: null,
      telefonoWhatsapp: "+59171160099",
      tipoDocumento: "ci",
      numeroDocumento: "1234567",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      estatus: "activo",
      colorRiesgo: "blanco",
    });
    clienteId = cliente.id;

    const prestamo = await prestamoRepo.save({
      cliente: { id: clienteId } as Cliente,
      clienteId,
      cartera: { id: carteraId } as Cartera,
      carteraId,
      valor: 1000,
      numCuotas: 4,
      tipoInteres: 20,
      diasEntreCuotas: 7,
      fechaOtorgado: new Date("2026-01-01T00:00:00Z"),
      estatus: "vigente",
    });
    prestamoId = prestamo.id;
  });

  afterAll(async () => {
    if (prestamoId) {
      await cuotaRepo
        .createQueryBuilder()
        .delete()
        .where("prestamo_id = :prestamoId", { prestamoId })
        .execute();
      await prestamoRepo.delete({ id: prestamoId });
    }
    if (clienteId) {
      await clienteRepo.delete({ id: clienteId });
    }
    if (carteraId) {
      await carteraRepo.delete({ id: carteraId });
    }
    await gestorRepo.delete({ codigo: "CB-MORA-E2E" });
    await propietarioRepo.delete({ codigo: "SC-MORA-E2E" });
    await app.close();
  });

  it("marca como atrasada una cuota pendiente con vencimiento anterior a hoy", async () => {
    await cuotaRepo.save([
      {
        prestamo: { id: prestamoId } as Prestamo,
        prestamoId,
        numeroCuota: 1,
        valorEsperado: 300,
        fechaVencimiento: "2020-01-10",
        estatus: "pendiente",
      },
      {
        prestamo: { id: prestamoId } as Prestamo,
        prestamoId,
        numeroCuota: 2,
        valorEsperado: 300,
        fechaVencimiento: "2999-01-01",
        estatus: "pendiente",
      },
    ] as never);

    const marcadas = await moraJob.ejecutar(new Date("2026-08-17T00:00:00Z"));

    expect(marcadas).toBe(1);
    const cuota1 = await cuotaRepo
      .createQueryBuilder("cu")
      .where("cu.prestamo_id = :prestamoId AND cu.numero_cuota = 1", { prestamoId })
      .getOne();
    const cuota2 = await cuotaRepo
      .createQueryBuilder("cu")
      .where("cu.prestamo_id = :prestamoId AND cu.numero_cuota = 2", { prestamoId })
      .getOne();
    expect(cuota1?.estatus).toBe("atrasada");
    expect(cuota2?.estatus).toBe("pendiente");

    await cuotaRepo
      .createQueryBuilder()
      .delete()
      .where("prestamo_id = :prestamoId", { prestamoId })
      .execute();
  });
});
