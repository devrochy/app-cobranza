import type { CellValue } from "exceljs";

/** Nombres canónicos de columna esperados en `cartera.xlsx` (mayúsculas, sin tildes). */
export const COLUMNAS = {
  FECHA: "FECHA",
  NOMBRE: "NOMBRE",
  APELLIDO: "APELLIDO",
  CEDULA: "CEDULA",
  TELEFONO: "TELEFONO",
  LATITUD: "LATITUD",
  LONGITUD: "LONGITUD",
  DIAS_ENTRE_CUOTAS: "DIAS ENTRE CUOTAS",
  PRESTAMO: "PRESTAMO",
  INTERES: "INTERES",
  VALOR_TARJETA: "VALOR TARJETA",
  NRO_CUOTAS: "NRO CUOTAS",
  VALOR_CUOTA: "VALOR CUOTA",
  CUOTAS_A_LA_FECHA: "CUOTAS A LA FECHA",
  LIQUIDO: "LIQUIDO",
  COBRO: "COBRO",
  CUOTAS_CARTERA: "CUOTAS CARTERA",
  CARTERA: "CARTERA",
} as const;

/** Fila de préstamo parseada de la hoja (una por préstamo). */
export interface FilaImport {
  /** Número de fila en la hoja (1-based), para reportar errores. */
  fila: number;
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
  latitud: number;
  longitud: number;
  diasEntreCuotas: number;
  /** Fecha del préstamo en `YYYY-MM-DD`. */
  fecha: string;
  /** Capital del préstamo. */
  prestamo: number;
  /** Monto de interés (no el porcentaje). */
  interes: number;
  numCuotas: number;
  cuotasALaFecha: number;
  liquido: number;
  /** Derivados leídos para validar coherencia. */
  valorTarjeta: number | null;
  valorCuota: number | null;
  cobro: number | null;
  cuotasCartera: number | null;
  cartera: number | null;
}

export function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Parsea un monto (número o string tipo "1.000,00 Bs"). Devuelve null si no es monto. */
export function parsearMonto(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }
  if (valor instanceof Date) {
    return null;
  }
  const limpio = String(valor).replace(/[^\d.,-]/g, "");
  if (!limpio || limpio === "-") {
    return null;
  }
  let norm = limpio;
  if (norm.includes(",") && norm.includes(".")) {
    // es-BO: punto = miles, coma = decimal.
    norm = norm.replace(/\./g, "").replace(",", ".");
  } else if (norm.includes(",") && !norm.includes(".")) {
    norm = norm.replace(",", ".");
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** Parsea una fecha (Date, serial de Excel o string). Devuelve `YYYY-MM-DD` o null. */
export function parsearFecha(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }
  if (valor instanceof Date) {
    return aIso(valor);
  }
  if (typeof valor === "number") {
    return aIso(new Date(Date.UTC(1899, 11, 30) + valor * 86400000));
  }
  const texto = String(valor).trim();
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  }
  const dma = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dma) {
    return `${dma[3]}-${pad(dma[2])}-${pad(dma[1])}`;
  }
  return null;
}

function pad(n: string): string {
  return n.length === 1 ? `0${n}` : n;
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function entero(valor: number | null, porDefecto = 0): number {
  if (valor === null) {
    return porDefecto;
  }
  return Math.trunc(valor);
}

/**
 * Normaliza el valor crudo de una celda: extrae el `result` de las fórmulas
 * (INTERES, VALOR TARJETA, COBRO, etc. son fórmulas en la hoja) y el texto de
 * rich text.
 */
function valorCrudo(valor: CellValue): unknown {
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    const obj = valor as {
      result?: unknown;
      richText?: { text: string }[];
      text?: string;
    };
    if ("result" in obj) {
      return obj.result;
    }
    if (obj.richText) {
      return obj.richText.map((t) => t.text).join("");
    }
    if (typeof obj.text === "string") {
      return obj.text;
    }
  }
  return valor;
}

/**
 * Lee `cartera.xlsx` y devuelve las filas de préstamo (ignora la sección de
 * resumen y las filas sin FECHA/NOMBRE/PRESTAMO).
 */
export async function parsearCarteraXlsx(buffer: Buffer): Promise<FilaImport[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const hoja = workbook.worksheets[0];
  if (!hoja) {
    return [];
  }

  const cabeceras = new Map<string, number>();
  hoja.getRow(1).eachCell({ includeEmpty: false }, (cell, numeroColumna) => {
    const nombre = normalizarEncabezado(cell.value);
    if (nombre) {
      cabeceras.set(nombre, numeroColumna);
    }
  });

  const filas: FilaImport[] = [];
  hoja.eachRow((row, numeroFila) => {
    if (numeroFila === 1) {
      return;
    }
    const celda = (columna: string): unknown => {
      const indice = cabeceras.get(columna);
      return indice ? valorCrudo(row.getCell(indice).value) : undefined;
    };

    const fecha = parsearFecha(celda(COLUMNAS.FECHA));
    const nombre = String(celda(COLUMNAS.NOMBRE) ?? "").trim();
    const prestamo = parsearMonto(celda(COLUMNAS.PRESTAMO));
    // Una fila es de préstamo solo si tiene fecha, nombre y capital; así se
    // descartan las filas de resumen del negocio (inversión, caja, gastos).
    if (!fecha || !nombre || prestamo === null || prestamo === 0) {
      return;
    }

    filas.push({
      fila: numeroFila,
      nombre,
      apellido: String(celda(COLUMNAS.APELLIDO) ?? "").trim(),
      cedula: String(celda(COLUMNAS.CEDULA) ?? "").trim(),
      telefono: String(celda(COLUMNAS.TELEFONO) ?? "").trim(),
      latitud: parsearMonto(celda(COLUMNAS.LATITUD)) ?? 0,
      longitud: parsearMonto(celda(COLUMNAS.LONGITUD)) ?? 0,
      diasEntreCuotas: entero(parsearMonto(celda(COLUMNAS.DIAS_ENTRE_CUOTAS))),
      fecha,
      prestamo,
      interes: parsearMonto(celda(COLUMNAS.INTERES)) ?? 0,
      numCuotas: entero(parsearMonto(celda(COLUMNAS.NRO_CUOTAS))),
      cuotasALaFecha: entero(parsearMonto(celda(COLUMNAS.CUOTAS_A_LA_FECHA))),
      liquido: entero(parsearMonto(celda(COLUMNAS.LIQUIDO))),
      valorTarjeta: parsearMonto(celda(COLUMNAS.VALOR_TARJETA)),
      valorCuota: parsearMonto(celda(COLUMNAS.VALOR_CUOTA)),
      cobro: parsearMonto(celda(COLUMNAS.COBRO)),
      cuotasCartera: parsearMonto(celda(COLUMNAS.CUOTAS_CARTERA)),
      cartera: parsearMonto(celda(COLUMNAS.CARTERA)),
    });
  });

  return filas;
}
