/**
 * Formatea una fecha a `YYYY-MM-DD` en UTC, consistente con la generación de
 * cuotas y el job de mora (las fechas de vencimiento se almacenan como date sin
 * zona horaria).
 */
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
