import { BadRequestException } from "@nestjs/common";
import { ImportarCarteraController } from "./importar-cartera.controller";
import { ImportarCarteraService } from "./importar-cartera.service";
import type { FilaImport } from "./importar-cartera.parser";

jest.mock("./importar-cartera.parser", () => ({
  parsearCarteraXlsx: jest.fn(),
}));

import { parsearCarteraXlsx } from "./importar-cartera.parser";

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

const req = { user: { rol: "admin", sub: 1 } } as never;
const archivo = { buffer: Buffer.from("x") } as Express.Multer.File;

describe("ImportarCarteraController", () => {
  let service: { importar: jest.Mock };
  let controller: ImportarCarteraController;

  beforeEach(() => {
    jest.clearAllMocks();
    service = { importar: jest.fn() };
    controller = new ImportarCarteraController(service as unknown as ImportarCarteraService);
  });

  it("dryRun valida sin escribir", async () => {
    (parsearCarteraXlsx as jest.Mock).mockResolvedValue([fila()]);

    const res = (await controller.importar(1, archivo, "true", req)) as {
      total: number;
      conErrores: number;
    };

    expect(res.total).toBe(1);
    expect(res.conErrores).toBe(0);
    expect(service.importar).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si hay filas con errores (sin dryRun)", async () => {
    (parsearCarteraXlsx as jest.Mock).mockResolvedValue([fila({ cedula: "" })]);

    await expect(controller.importar(1, archivo, undefined, req)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.importar).not.toHaveBeenCalled();
  });

  it("importa cuando no hay errores", async () => {
    (parsearCarteraXlsx as jest.Mock).mockResolvedValue([fila()]);
    service.importar.mockResolvedValue({ creados: 1, omitidos: 0, filas: [] });

    const res = await controller.importar(1, archivo, undefined, req);

    expect(service.importar).toHaveBeenCalledWith(1, [fila()], { rol: "admin", sub: 1 });
    expect(res).toMatchObject({ creados: 1 });
  });

  it("rechaza si falta el archivo", async () => {
    await expect(controller.importar(1, undefined, "true", req)).rejects.toThrow(
      BadRequestException,
    );
  });
});
