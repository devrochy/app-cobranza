export type DerivacionMotivo =
  | "solicitud_agente"
  | "disputa_monto"
  | "queja"
  | "lenguaje_agresivo"
  | "fraude";

export interface ResultadoDerivacion {
  deriva: boolean;
  motivo: DerivacionMotivo | null;
}

interface ReglaDerivacion {
  motivo: DerivacionMotivo;
  palabrasClave: string[];
}

/**
 * HU-32: detecta de forma determinista (MVP Fase 1, sin LLM) si un mensaje del
 * cliente requiere derivar la conversación a un agente humano. Cubre solicitud
 * de atención personalizada, disputa del monto, queja/reclamo, lenguaje agresivo
 * y fraude sospechado. Prioridad: primera coincidencia en orden del catálogo.
 */
const REGLAS_DERIVACION: ReglaDerivacion[] = [
  {
    motivo: "solicitud_agente",
    palabrasClave: [
      "hablar con un agente",
      "hablar con alguien",
      "agente",
      "humano",
      "persona",
      "que me atienda",
      "atención personalizada",
      "representante",
    ],
  },
  {
    motivo: "disputa_monto",
    palabrasClave: [
      "disputa",
      "no me corresponde",
      "monto incorrecto",
      "cobro incorrecto",
      "está mal",
    ],
  },
  {
    motivo: "queja",
    palabrasClave: ["queja", "reclam"],
  },
  {
    motivo: "lenguaje_agresivo",
    palabrasClave: [
      "demand",
      "denunciar",
      "malnacido",
      "hijo de puta",
      "hijueputa",
      "estafador",
      "idiota",
      "imbécil",
      "basura",
      "ladron",
      "mentiroso",
      "abogado",
      "no me molestes",
    ],
  },
  {
    motivo: "fraude",
    palabrasClave: ["fraude", "estafa", "no soy yo", "suplant", "clon", "robo"],
  },
];

export function detectarDerivacion(
  mensaje: string | null | undefined,
): ResultadoDerivacion {
  const normalizado = normalizar(mensaje);
  if (!normalizado) {
    return { deriva: false, motivo: null };
  }

  for (const regla of REGLAS_DERIVACION) {
    const coincide = regla.palabrasClave.some((p) => normalizado.includes(normalizar(p)));
    if (coincide) {
      return { deriva: true, motivo: regla.motivo };
    }
  }

  return { deriva: false, motivo: null };
}

function normalizar(mensaje: string | null | undefined): string {
  return (mensaje ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}