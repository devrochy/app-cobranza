import { formatDate } from "../../common/date";

/**
 * Periodo del cobro mensual del socio en formato YYYY-MM (UTC).
 */
export function periodoDeFecha(fecha: Date): string {
  return formatDate(fecha).slice(0, 7);
}

/**
 * Fecha de vencimiento del cobro para un periodo: el día ancla (día de alta del
 * socio) del mes, clampeado al último día del mes cuando no lo contiene.
 */
export function calcularFechaVencimiento(periodo: string, diaAncla: number): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dia = Math.min(diaAncla, ultimoDia);
  return `${periodo}-${String(dia).padStart(2, "0")}`;
}

/**
 * True si la fecha es el vencimiento del cobro del periodo actual (día de cobro).
 */
export function esDiaDeCobro(fecha: Date, diaAncla: number): boolean {
  return formatDate(fecha) === calcularFechaVencimiento(periodoDeFecha(fecha), diaAncla);
}

/**
 * Día en que se genera el cobro del periodo: `diasAnticipacion` antes de su
 * vencimiento (para que el recordatorio "antes" tenga un cobro que notificar).
 * Con `diasAnticipacion = 0` se genera el mismo día del vencimiento.
 */
export function fechaGeneracionCobro(
  periodo: string,
  diaAncla: number,
  diasAnticipacion: number,
): string {
  const vencimiento = calcularFechaVencimiento(periodo, diaAncla);
  const fecha = new Date(`${vencimiento}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - diasAnticipacion);
  return formatDate(fecha);
}

/**
 * Día del mes ancla al cobro, tomado del createdAt (alta) del socio en UTC.
 */
export function diaAnclaDe(createdAt: Date): number {
  return createdAt.getUTCDate();
}

/**
 * Suma días a una fecha (UTC) y devuelve la nueva fecha.
 */
export function addDays(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}