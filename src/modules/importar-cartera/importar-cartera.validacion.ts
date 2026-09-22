import { validarNumeroDocumento } from "../../domain/tipo-documento";
import type { FilaImport } from "./importar-cartera.parser";

export interface ErrorFila {
  fila: number;
  errores: string[];
}

export interface ValidacionImport {
  total: number;
  conErrores: number;
  errores: ErrorFila[];
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function casiIgual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

function validarFila(fila: FilaImport): string[] {
  const errores: string[] = [];

  if (!fila.nombre) errores.push("Falta NOMBRE");
  if (!fila.apellido) errores.push("Falta APELLIDO");
  if (!fila.cedula) {
    errores.push("Falta CEDULA");
  } else if (!validarNumeroDocumento("ci", fila.cedula)) {
    errores.push("Cédula no válida (CI)");
  }
  if (!fila.telefono) {
    errores.push("Falta TELEFONO");
  } else if (soloDigitos(fila.telefono).length < 7) {
    errores.push("Teléfono no válido");
  }
  if (!fila.fecha) errores.push("Falta FECHA");
  if (fila.diasEntreCuotas < 1) errores.push("DIAS ENTRE CUOTAS debe ser >= 1");
  if (fila.prestamo <= 0) errores.push("PRESTAMO debe ser mayor que 0");
  if (fila.numCuotas < 1) errores.push("NRO CUOTAS debe ser >= 1");
  if (fila.cuotasALaFecha < 0 || fila.cuotasALaFecha > fila.numCuotas) {
    errores.push("CUOTAS A LA FECHA fuera de rango");
  }
  if (fila.liquido < 0 || fila.liquido > fila.numCuotas) {
    errores.push("LIQUIDO fuera de rango");
  }

  if (fila.latitud === 0 && fila.longitud === 0) {
    errores.push("Faltan coordenadas (LATITUD/LONGITUD)");
  } else {
    if (fila.latitud < -90 || fila.latitud > 90) errores.push("LATITUD fuera de rango");
    if (fila.longitud < -180 || fila.longitud > 180) errores.push("LONGITUD fuera de rango");
  }

  // Coherencia de derivados (solo si la columna trae valor).
  const valorTotal = fila.prestamo + fila.interes;
  if (fila.valorTarjeta !== null && !casiIgual(fila.valorTarjeta, valorTotal)) {
    errores.push(`VALOR TARJETA no coincide (esperado ${redondear2(valorTotal)})`);
  }
  const cuotaBase = redondear2(valorTotal / fila.numCuotas);
  if (fila.valorCuota !== null && !casiIgual(fila.valorCuota, cuotaBase)) {
    errores.push(`VALOR CUOTA no coincide (esperado ${cuotaBase})`);
  }
  if (
    fila.cobro !== null &&
    fila.valorCuota !== null &&
    !casiIgual(fila.cobro, redondear2(fila.valorCuota * fila.cuotasALaFecha))
  ) {
    errores.push("COBRO no coincide");
  }
  if (
    fila.cuotasCartera !== null &&
    fila.cuotasCartera !== fila.numCuotas - fila.cuotasALaFecha
  ) {
    errores.push("CUOTAS CARTERA no coincide");
  }
  if (
    fila.cartera !== null &&
    fila.valorCuota !== null &&
    fila.cuotasCartera !== null &&
    !casiIgual(fila.cartera, redondear2(fila.valorCuota * fila.cuotasCartera))
  ) {
    errores.push("CARTERA no coincide");
  }

  return errores;
}

/** Valida todas las filas y detecta préstamos duplicados (cédula + fecha). */
export function validarFilas(filas: FilaImport[]): ValidacionImport {
  const errores: ErrorFila[] = [];
  const vistos = new Set<string>();

  for (const fila of filas) {
    const erroresFila = validarFila(fila);
    const clave = `${fila.cedula}|${fila.fecha}`;
    if (fila.cedula && fila.fecha && vistos.has(clave)) {
      erroresFila.push("Préstamo duplicado (cédula + fecha)");
    }
    vistos.add(clave);
    if (erroresFila.length > 0) {
      errores.push({ fila: fila.fila, errores: erroresFila });
    }
  }

  return {
    total: filas.length,
    conErrores: errores.length,
    errores,
  };
}
