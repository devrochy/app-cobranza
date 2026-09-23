import {
  COLUMNAS,
  normalizarEncabezado,
  parsearCarteraXlsx,
  parsearFecha,
  parsearMonto,
} from "./importar-cartera.parser";

// exceljs es lento al leer/escribir workbooks; se amplía el timeout por defecto.
jest.setTimeout(30000);

describe("parsearMonto", () => {
  it("acepta números directos", () => {
    expect(parsearMonto(1000)).toBe(1000);
    expect(parsearMonto(50.5)).toBe(50.5);
  });

  it("parsea el formato es-BO '1.000,00 Bs'", () => {
    expect(parsearMonto("1.000,00 Bs")).toBe(1000);
    expect(parsearMonto("500,00 Bs")).toBe(500);
  });

  it("parsea coma decimal simple", () => {
    expect(parsearMonto("42,00")).toBe(42);
  });

  it("devuelve null para valores no numéricos o vacíos", () => {
    expect(parsearMonto("")).toBeNull();
    expect(parsearMonto(null)).toBeNull();
    expect(parsearMonto("CARLOS")).toBeNull();
  });
});

describe("parsearFecha", () => {
  it("acepta Date", () => {
    expect(parsearFecha(new Date(Date.UTC(2026, 8, 14)))).toBe("2026-09-14");
  });

  it("acepta serial de Excel", () => {
    // 46279 = 2026-09-14
    expect(parsearFecha(46279)).toBe("2026-09-14");
  });

  it("acepta string YYYY-MM-DD y DD/MM/YYYY", () => {
    expect(parsearFecha("2026-09-14")).toBe("2026-09-14");
    expect(parsearFecha("14/09/2026")).toBe("2026-09-14");
  });

  it("devuelve null para vacío", () => {
    expect(parsearFecha("")).toBeNull();
    expect(parsearFecha(null)).toBeNull();
  });
});

describe("normalizarEncabezado", () => {
  it("normaliza mayúsculas, tildes y espacios", () => {
    expect(normalizarEncabezado("  días entre cuotas ")).toBe("DIAS ENTRE CUOTAS");
    expect(normalizarEncabezado("CÉDULA")).toBe("CEDULA");
  });
});

describe("parsearCarteraXlsx", () => {
  async function generarHoja(conFechaReporte = true): Promise<Buffer> {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("cartera");
    ws.addRow([
      "FECHA", "NOMBRE", "APELLIDO", "CEDULA", "TELEFONO", "LATITUD", "LONGITUD",
      "DIAS ENTRE CUOTAS", "PRESTAMO", "INTERES", "VALOR TARJETA", "NRO CUOTAS",
      "VALOR CUOTA", "CUOTAS A LA FECHA", "LIQUIDO", "COBRO", "CUOTAS CARTERA", "CARTERA",
    ]);
    ws.addRow([
      new Date(Date.UTC(2026, 8, 14)), "CARLOS", "PEREZ", "6334116", "59177388488",
      -17.78, -63.18, 7, 1000, 200, 1200, 24, 50, 5, 5, 250, 19, 950,
    ]);
    // VALOR TARJETA (col K) es una fórmula en la hoja real.
    ws.getCell("K2").value = { formula: "I2+J2", result: 1200 };
    ws.addRow([
      new Date(Date.UTC(2026, 8, 15)), "ANA", "RUIZ", "9759716", "59177615454",
      -17.79, -63.19, 7, 2500, 500, 3000, 24, 125, 5, 5, 625, 19, 2375,
    ]);
    // Fila de resumen del negocio (valor en PRESTAMO pero sin FECHA/NOMBRE): se ignora.
    ws.addRow(["ALQUILER", "", "", "", "", "", "", "", 500]);
    ws.addRow(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "23500"]);
    if (conFechaReporte) {
      ws.getCell("A7").value = "FECHA REPORTE";
      ws.getCell("B7").value = new Date(Date.UTC(2026, 8, 23));
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it("devuelve solo las filas de préstamo (ignora el resumen)", async () => {
    const { filas } = await parsearCarteraXlsx(await generarHoja());
    expect(filas).toHaveLength(2);
  });

  it("lee la fecha de reporte de la celda etiquetada FECHA REPORTE", async () => {
    const { fechaReporte } = await parsearCarteraXlsx(await generarHoja());
    expect(fechaReporte).toBe("2026-09-23");
  });

  it("usa la fecha de hoy si no hay celda FECHA REPORTE", async () => {
    const { fechaReporte } = await parsearCarteraXlsx(await generarHoja(false));
    const hoy = new Date();
    const esperado = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, "0")}-${String(hoy.getUTCDate()).padStart(2, "0")}`;
    expect(fechaReporte).toBe(esperado);
  });

  it("lee el resultado de las celdas con fórmula", async () => {
    const { filas } = await parsearCarteraXlsx(await generarHoja());
    expect(filas[0].valorTarjeta).toBe(1200);
  });

  it("mapea los campos por nombre de columna", async () => {
    const { filas } = await parsearCarteraXlsx(await generarHoja());
    expect(filas[0]).toMatchObject({
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
    });
  });

  it("expone los nombres canónicos de columna requeridos", () => {
    expect(COLUMNAS.CEDULA).toBe("CEDULA");
    expect(COLUMNAS.DIAS_ENTRE_CUOTAS).toBe("DIAS ENTRE CUOTAS");
    expect(COLUMNAS.FECHA_REPORTE).toBe("FECHA REPORTE");
  });
});
