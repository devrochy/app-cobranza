export type IntencionIa = "consulta_saldo" | "promesa_pago" | "desconocida";

interface ReglaIntencion {
  intencion: IntencionIa;
  /** Palabras clave (normalizadas a minúsculas) que activan la intención. */
  palabrasClave: string[];
}

/**
 * Catálogo de intenciones reconocibles por el asistente (determinista, sin LLM,
 * MVP Fase 1). El PRD 3.3 describe una clasificación por modelo (Fase 2); en el
 * MVP la detección es por palabras clave. Este catálogo se extiende al añadir
 * HU-28 (promesa de pago), HU-29 (negociación) y HU-32 (derivación).
 */
const REGLAS_INTENCION: ReglaIntencion[] = [
  {
    intencion: "consulta_saldo",
    palabrasClave: [
      "saldo",
      "cuanto debo",
      "cuanto me falta",
      "debo",
      "deuda",
      "proxima cuota",
      "vencimiento",
      "cuando vence",
      "estado de cuenta",
      "cuanto es",
    ],
  },
  {
    intencion: "promesa_pago",
    palabrasClave: [
      "pago",
      "pagar",
      "promesa",
      "compromiso",
      "abono",
      "abonar",
      "refinanciar",
      "reprogramar",
      "plan de pago",
      "plan de pagos",
    ],
  },
];

/**
 * HU-27: detecta la intención de un mensaje del cliente de forma determinista.
 * Normaliza a minúsculas, quita acentos y busca palabras clave. Devuelve
 * `desconocida` si no hay coincidencia o si el mensaje está vacío.
 */
export function detectarIntencion(mensaje: string | null | undefined): IntencionIa {
  const normalizado = normalizar(mensaje);
  if (!normalizado) {
    return "desconocida";
  }

  for (const regla of REGLAS_INTENCION) {
    const coincide = regla.palabrasClave.some((palabra) => normalizado.includes(palabra));
    if (coincide) {
      return regla.intencion;
    }
  }

  return "desconocida";
}

function normalizar(mensaje: string | null | undefined): string {
  return (mensaje ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
