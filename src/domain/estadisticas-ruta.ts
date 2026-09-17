/**
 * Estadísticas operativas por ruta (pantalla tipo "Smart 369"/monitoreo).
 * Los conteos se calculan para una fecha puntual y se persisten como snapshot
 * diario para poder comparar contra el día anterior (deltas).
 */

export const ESTADISTICAS_CAMPOS = [
  "totalClientes",
  "clientesAtrasados",
  "clientesVencidos",
  "sinVisitaHoy",
  "sinVisitaDesdeUltimaLiquidada",
  "conPrestamosNuevos",
  "conMasDeUnPrestamo",
  "clientesNuevos",
] as const;

export type EstadisticaCampo = (typeof ESTADISTICAS_CAMPOS)[number];

export type EstadisticasConteos = Record<EstadisticaCampo, number>;

export interface EstadisticasRuta {
  rutaId: number;
  /** Fecha (YYYY-MM-DD) a la que corresponden los conteos actuales. */
  fecha: string;
  actual: EstadisticasConteos;
  /** Snapshot del día anterior; null si aún no existe. */
  anterior: EstadisticasConteos | null;
  /** actual − anterior por campo; null cuando no hay snapshot anterior. */
  deltas: Record<EstadisticaCampo, number | null>;
  /** Momento en que se calculó/actualizó la respuesta. */
  actualizadoEn: string;
}

export function calcularDeltas(
  actual: EstadisticasConteos,
  anterior: EstadisticasConteos | null,
): Record<EstadisticaCampo, number | null> {
  const deltas = {} as Record<EstadisticaCampo, number | null>;
  for (const campo of ESTADISTICAS_CAMPOS) {
    deltas[campo] = anterior ? actual[campo] - anterior[campo] : null;
  }
  return deltas;
}

export function conteosDesdeSnapshot(snapshot: EstadisticasConteos): EstadisticasConteos {
  const conteos = {} as EstadisticasConteos;
  for (const campo of ESTADISTICAS_CAMPOS) {
    conteos[campo] = snapshot[campo];
  }
  return conteos;
}
