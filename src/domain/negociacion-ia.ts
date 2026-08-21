export type TipoNegociacion = "promesa" | "abono_parcial" | "refinanciacion";

/**
 * HU-29: determina el tipo de negociación/acuerdo a partir del mensaje del
 * cliente, de forma determinista (MVP Fase 1, sin LLM). Prioridad: refinanciación
 * > abono parcial > promesa (default). Las promesas de pago simples (HU-28)
 * caen en `promesa`.
 */
export function detectarTipoNegociacion(
  mensaje: string | null | undefined,
): TipoNegociacion {
  const normalizado = (mensaje ?? "").toLowerCase().trim();
  if (!normalizado) {
    return "promesa";
  }

  const esRefinanciacion = [
    "refinanci",
    "reprogram",
    "reestructur",
    "plan de pago",
    "plan de pagos",
  ].some((p) => normalizado.includes(p));

  if (esRefinanciacion) {
    return "refinanciacion";
  }

  if (normalizado.includes("abono") || normalizado.includes("abonar")) {
    return "abono_parcial";
  }

  return "promesa";
}
