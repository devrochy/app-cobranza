import { calcularColorRiesgo } from "./color-riesgo";

export const COLOR_LISTA_DIA = ["verde", "rojo", "blanco"] as const;
export type ColorListaDelDia = (typeof COLOR_LISTA_DIA)[number];

/**
 * HU-56: color del cliente en la lista del día.
 * - blanco: cliente nuevo o con crédito finalizado (HU-13, prioridad máxima).
 * - verde:  cliente con visita de pago HOY (pagó anticipado) o al día
 *           (atraso bajo el umbral). Mapea el "azul" de HU-13 a "verde"
 *           SOLO en la lista del día.
 * - rojo:   moroso (atraso >= umbral) sin pago de hoy.
 */
export function colorListaDelDia(
  atraso: number,
  umbral: number,
  esNuevoOCreditosFinalizados: boolean,
  tieneVisitaPagoHoy: boolean,
): ColorListaDelDia {
  if (esNuevoOCreditosFinalizados) {
    return "blanco";
  }
  if (tieneVisitaPagoHoy) {
    return "verde";
  }
  const base = calcularColorRiesgo(atraso, umbral, false);
  return base === "rojo" ? "rojo" : "verde";
}