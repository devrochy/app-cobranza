export const COLOR_RIESGO = ["azul", "rojo", "blanco"] as const;
export type ColorRiesgo = (typeof COLOR_RIESGO)[number];

/**
 * HU-13: código de color por cliente según su nivel de atraso.
 * - blanco: cliente nuevo (sin crédito) o crédito finalizado (todas las cuotas pagadas).
 * - rojo:  atraso >= umbral de la ruta (umbral inclusivo).
 * - azul:  bajo el umbral.
 * El umbral proviene de `ruta_config.cuotas_atraso_umbral` (HU-10) en el punto
 * de llamada (wiring en HU-14/15, cuando existan clientes/préstamos/cuotas).
 * Contrato: `atraso` y `umbral` se asumen no negativos (el atraso es un conteo
 * de cuotas vencidas; el umbral viene de ruta_config). Con ambos en 0 el
 * resultado es "rojo" (0 >= 0, regla inclusiva).
 */
export function calcularColorRiesgo(
  atraso: number,
  umbral: number,
  esNuevoOCreditosFinalizados: boolean,
): ColorRiesgo {
  if (esNuevoOCreditosFinalizados) {
    return "blanco";
  }
  return atraso >= umbral ? "rojo" : "azul";
}
