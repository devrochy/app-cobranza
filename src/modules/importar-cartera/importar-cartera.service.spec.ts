import { NotFoundException } from "@nestjs/common";
import { ImportarCarteraService } from "./importar-cartera.service";
import type { FilaImport } from "./importar-cartera.parser";
import { Cartera } from "../carteras/cartera.entity";
import { Cliente } from "../clientes/cliente.entity";
import { Prestamo } from "../clientes/prestamo.entity";
import { Cuota } from "../clientes/cuota.entity";
import { Pago } from "../clientes/pago.entity";

function fila(overrides: Partial<FilaImport> = {}): FilaImport {
  return {
    fila: 2,
    nombre: "CARLOS",
    apellido: "PEREZ",
    cedula: "6334116",
    telefono: "59177388488",
    latitud: -17.78,
    longitud: -63.18,
    diasEntreCuotas: 7,
    fecha: "2026-09-14",
    prestamo: 1000,
    interes: 200,
    numCuotas: 24,
    cuotasALaFecha: 5,
    liquido: 5,
    valorTarjeta: 1200,
    valorCuota: 50,
    cobro: 250,
    cuotasCartera: 19,
    cartera: 950,
    ...overrides,
  };
}

function crearService(overrides: {
  cartera?: Cartera | null;
  clienteExistente?: Cliente | null;
  prestamoExistente?: (Prestamo | null)[];
} = {}) {
  const carteraRepo = {
    findOne: jest.fn().mockResolvedValue(
      overrides.cartera === undefined ? ({ id: 1, propietarioId: 1 } as Cartera) : overrides.cartera,
    ),
  };
  const clienteRepo = {
    findOne: jest.fn().mockResolvedValue(overrides.clienteExistente ?? null),
    create: jest.fn((e: unknown) => e),
    save: jest.fn(async (e: unknown) => ({ ...(e as object), id: 1 })),
  };
  const prestamoRepo = {
    findOne: overrides.prestamoExistente
      ? jest
          .fn()
          .mockResolvedValueOnce(overrides.prestamoExistente[0])
          .mockResolvedValueOnce(overrides.prestamoExistente[1] ?? null)
      : jest.fn().mockResolvedValue(null),
    create: jest.fn((e: unknown) => e),
    save: jest.fn(async (e: unknown) => ({ ...(e as object), id: 100 })),
    update: jest.fn(),
  };
  const cuotaRepo = {
    save: jest.fn(async (arr: unknown) =>
      Array.isArray(arr)
        ? arr.map((c: object, i: number) => ({ ...c, id: i + 1 }))
        : { ...(arr as object), id: 1 },
    ),
    update: jest.fn(),
  };
  const pagoRepo = {
    create: jest.fn((e: unknown) => e),
    save: jest.fn(async (e: unknown) => e),
  };

  const repos = new Map<unknown, unknown>([
    [Cliente, clienteRepo],
    [Prestamo, prestamoRepo],
    [Cuota, cuotaRepo],
    [Pago, pagoRepo],
  ]);
  const dataSource = {
    transaction: jest.fn(async (fn: (m: { getRepository: (e: unknown) => unknown }) => Promise<unknown>) =>
      fn({ getRepository: (e: unknown) => repos.get(e) ?? { save: jest.fn() } }),
    ),
  };

  const service = new ImportarCarteraService(
    dataSource as never,
    carteraRepo as never,
    clienteRepo as never,
    prestamoRepo as never,
    cuotaRepo as never,
    pagoRepo as never,
  );

  return { service, carteraRepo, clienteRepo, prestamoRepo, cuotaRepo, pagoRepo };
}

const requester = { rol: "admin" as const, sub: 0 };

describe("ImportarCarteraService.importar", () => {
  it("crea cliente y préstamo y deja el estado reportado (liquidado)", async () => {
    const { service, clienteRepo, prestamoRepo, cuotaRepo, pagoRepo } = crearService();

    const reporte = await service.importar(
      1,
      [fila({ numCuotas: 5, cuotasALaFecha: 5, liquido: 5, valorCuota: 240, valorTarjeta: 1200 })],
      requester,
    );

    expect(clienteRepo.save).toHaveBeenCalledTimes(1);
    expect(prestamoRepo.save).toHaveBeenCalledTimes(1);
    expect(cuotaRepo.save).toHaveBeenCalledTimes(1);
    expect(cuotaRepo.update).toHaveBeenCalledTimes(5);
    expect(pagoRepo.save).toHaveBeenCalledTimes(5);
    expect(prestamoRepo.update).toHaveBeenCalledWith(100, { estatus: "liquidado" });
    expect(reporte).toMatchObject({ creados: 1, omitidos: 0 });
  });

  it("marca solo las cuotas a la fecha y no liquida si falta", async () => {
    const { service, cuotaRepo, pagoRepo, prestamoRepo } = crearService();

    await service.importar(1, [fila({ numCuotas: 24, cuotasALaFecha: 5, liquido: 5 })], requester);

    expect(cuotaRepo.update).toHaveBeenCalledTimes(5);
    expect(pagoRepo.save).toHaveBeenCalledTimes(5);
    expect(prestamoRepo.update).not.toHaveBeenCalled();
  });

  it("reutiliza el cliente si ya existe por cédula", async () => {
    const { service, clienteRepo, prestamoRepo } = crearService({
      clienteExistente: { id: 9 } as Cliente,
    });

    await service.importar(
      1,
      [fila({ cedula: "6334116", fecha: "2026-09-14" }), fila({ cedula: "6334116", fecha: "2026-09-21" })],
      requester,
    );

    expect(clienteRepo.save).not.toHaveBeenCalled();
    expect(clienteRepo.findOne).toHaveBeenCalledTimes(1);
    expect(prestamoRepo.save).toHaveBeenCalledTimes(2);
  });

  it("omite un préstamo duplicado (cédula + fecha)", async () => {
    const { service, prestamoRepo } = crearService({
      prestamoExistente: [null, { id: 100 } as Prestamo],
    });

    const reporte = await service.importar(
      1,
      [fila({ cedula: "6334116", fecha: "2026-09-14" }), fila({ cedula: "6334116", fecha: "2026-09-14" })],
      requester,
    );

    expect(prestamoRepo.save).toHaveBeenCalledTimes(1);
    expect(reporte).toMatchObject({ creados: 1, omitidos: 1 });
  });

  it("rechaza si la cartera no existe", async () => {
    const { service } = crearService({ cartera: null });

    await expect(service.importar(999, [fila()], requester)).rejects.toThrow(NotFoundException);
  });
});
