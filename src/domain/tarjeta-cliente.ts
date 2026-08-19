export type TipoPagoTarjeta = "diario" | "semanal" | "quincenal" | "mensual" | "Varios";

/**
 * HU-58: deriva el tipo de pago del cliente a partir de la periodicidad de sus
 * préstamos (`dias_entre_cuotas`). Si hay préstamos con periodicidades distintas
 * → "Varios". "Fecha específica" no es inferible aquí (se documenta en backlog).
 */
export function tipoPagoDesdeDiasEntreCuotas(diasEntreCuotas: number[]): TipoPagoTarjeta | null {
  if (diasEntreCuotas.length === 0) {
    return null;
  }
  const primer = diasEntreCuotas[0];
  const todosIguales = diasEntreCuotas.every((d) => d === primer);
  if (!todosIguales) {
    return "Varios";
  }
  if (primer <= 1) return "diario";
  if (primer <= 7) return "semanal";
  if (primer <= 15) return "quincenal";
  return "mensual";
}

/**
 * HU-58: días de mora del cliente = días transcurridos desde la fecha de
 * vencimiento de la cuota vencida más antigua. Si no hay fecha → 0.
 * Acepta string ("YYYY-MM-DD") o Date (p. ej. desde getRawOne de Postgres).
 */
export function diasDeMora(fechaVencimientoMasAntigua: string | Date | null): number {
  if (!fechaVencimientoMasAntigua) {
    return 0;
  }
  const vencimiento =
    typeof fechaVencimientoMasAntigua === "string"
      ? new Date(`${fechaVencimientoMasAntigua}T00:00:00`)
      : new Date(fechaVencimientoMasAntigua);
  if (Number.isNaN(vencimiento.getTime())) {
    return 0;
  }
  vencimiento.setHours(0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diffMs = hoy.getTime() - vencimiento.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}