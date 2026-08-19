export const PERIODO_LIQUIDACION = ["diario", "semanal", "quincenal", "mensual"] as const;
export type PeriodoLiquidacion = (typeof PERIODO_LIQUIDACION)[number];

const DIAS_POR_PERIODO: Record<PeriodoLiquidacion, number> = {
  diario: 1,
  semanal: 7,
  quincenal: 14,
  mensual: 30,
};

export interface VentanaPeriodo {
  inicio: Date;
  fin: Date;
}

/**
 * Calcula la ventana (inicio inclusivo, fin inclusivo) del periodo de liquidación
 * vigente, anclada al día de cierre. `inicio` = `fin` menos N-1 días.
 */
export function calcularVentanaPeriodo(periodo: PeriodoLiquidacion, cierre: Date): VentanaPeriodo {
  const dias = DIAS_POR_PERIODO[periodo];
  const fin = new Date(cierre);
  fin.setHours(23, 59, 59, 999);
  const inicio = new Date(cierre);
  inicio.setDate(inicio.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fin };
}

/** Calcula la comisión sobre el total cobrado del periodo si está activa. */
export function calcularComision(
  totalCobradoPeriodo: number,
  comisionActiva: boolean,
  comisionPorcentaje: number,
): number {
  if (!comisionActiva || comisionPorcentaje <= 0) {
    return 0;
  }
  return Math.round(totalCobradoPeriodo * (comisionPorcentaje / 100) * 100) / 100;
}