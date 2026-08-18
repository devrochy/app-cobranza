import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { Cuota } from "../../src/modules/cartera/cuota.entity";
import { Prestamo } from "../../src/modules/cartera/prestamo.entity";
import { Cliente } from "../../src/modules/cartera/cliente.entity";
import { MoraJobService } from "../../src/modules/cartera/mora-job.service";
import { Cobrador } from "../../src/modules/cobradores/cobrador.entity";
import { Ruta } from "../../src/modules/rutas/ruta.entity";
import { Socio } from "../../src/modules/socios/socio.entity";

describe("Job de mora (e2e)", () => {
  let app: INestApplication;
  let cuotaRepo: Repository<Cuota>;
  let prestamoRepo: Repository<Prestamo>;
  let clienteRepo: Repository<Cliente>;
  let rutaRepo: Repository<Ruta>;
  let socioRepo: Repository<Socio>;
  let cobradorRepo: Repository<Cobrador>;
  let moraJob: MoraJobService;
  let rutaId: number;
  let clienteId: number;
  let prestamoId: number;
  let socioId: number;
  let cobradorId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cuotaRepo = moduleFixture.get(getRepositoryToken(Cuota));
    prestamoRepo = moduleFixture.get(getRepositoryToken(Prestamo));
    clienteRepo = moduleFixture.get(getRepositoryToken(Cliente));
    rutaRepo = moduleFixture.get(getRepositoryToken(Ruta));
    socioRepo = moduleFixture.get(getRepositoryToken(Socio));
    cobradorRepo = moduleFixture.get(getRepositoryToken(Cobrador));
    moraJob = moduleFixture.get(MoraJobService);

    // Limpieza completa en orden de FK por si quedan datos residuales de corridas previas.
    await cuotaRepo
      .createQueryBuilder()
      .delete()
      .where(
        "prestamo_id IN (SELECT p.id FROM prestamos p JOIN clientes c ON c.id = p.cliente_id JOIN rutas r ON r.id = c.ruta_id WHERE r.nombre = :nombre)",
        { nombre: "Ruta MORA-E2E" },
      )
      .execute();
    await prestamoRepo
      .createQueryBuilder()
      .delete()
      .where(
        "cliente_id IN (SELECT c.id FROM clientes c JOIN rutas r ON r.id = c.ruta_id WHERE r.nombre = :nombre)",
        { nombre: "Ruta MORA-E2E" },
      )
      .execute();
    await clienteRepo
      .createQueryBuilder()
      .delete()
      .where(
        "ruta_id IN (SELECT r.id FROM rutas r WHERE r.nombre = :nombre)",
        { nombre: "Ruta MORA-E2E" },
      )
      .execute();
    await rutaRepo
      .createQueryBuilder()
      .delete()
      .where("nombre = :nombre", { nombre: "Ruta MORA-E2E" })
      .execute();
    await cobradorRepo.delete({ codigo: "CB-MORA-E2E" });
    await socioRepo.delete({ codigo: "SC-MORA-E2E" });

    const socio = await socioRepo.save({
      usuario: "socio-mora-e2e",
      passwordHash: "x",
      nombre: "S",
      apellido: "E2E",
      correo: "socio-mora-e2e@correo.com",
      telefono: "+59171160097",
      codigo: "SC-MORA-E2E",
      moneda: "BOB",
      estatus: "activo",
    });
    socioId = socio.id;

    const cobrador = await cobradorRepo.save({
      socio: { id: socioId } as Socio,
      usuario: "cobrador-mora-e2e",
      passwordHash: "x",
      nombre: "C",
      apellido: "E2E",
      correo: "cobrador-mora-e2e@correo.com",
      telefono: "+59172270099",
      codigo: "CB-MORA-E2E",
      estatus: "activo",
    });
    cobradorId = cobrador.id;

    const ruta = await rutaRepo.save({
      socio: { id: socioId } as Socio,
      cobrador: { id: cobradorId } as Cobrador,
      nombre: "Ruta MORA-E2E",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 4,
      moneda: "BOB",
      estatus: "activo",
    });
    rutaId = ruta.id;

    const cliente = await clienteRepo.save({
      ruta: { id: rutaId } as Ruta,
      rutaId,
      nombre: "Ana",
      apellido: "Mora",
      negocio: null,
      telefonoWhatsapp: "+59171160099",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      estatus: "activo",
      colorRiesgo: "blanco",
    });
    clienteId = cliente.id;

    const prestamo = await prestamoRepo.save({
      cliente: { id: clienteId } as Cliente,
      clienteId,
      ruta: { id: rutaId } as Ruta,
      rutaId,
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
    if (rutaId) {
      await rutaRepo.delete({ id: rutaId });
    }
    await cobradorRepo.delete({ codigo: "CB-MORA-E2E" });
    await socioRepo.delete({ codigo: "SC-MORA-E2E" });
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
