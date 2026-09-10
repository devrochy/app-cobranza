/**
 * Tipos de documento de identidad del cliente. El número se valida con un
 * patrón distinto por tipo (`validarNumeroDocumento`).
 */
export const TIPOS_DOCUMENTO = ["ci", "pasaporte", "nit", "otro"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Etiquetas legibles para panel/APK. */
export const ETIQUETAS_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  ci: "Documento de Identidad",
  pasaporte: "Pasaporte",
  nit: "NIT",
  otro: "Otro",
};

const PATRONES: Record<TipoDocumento, RegExp> = {
  // CI: solo números (5-15 dígitos).
  ci: /^[0-9]{5,15}$/,
  pasaporte: /^[A-Z0-9]{5,15}$/,
  nit: /^[0-9-]{5,20}$/,
  otro: /^[A-Za-z0-9-]{3,30}$/,
};

export function esTipoDocumentoValido(valor: string): valor is TipoDocumento {
  return (TIPOS_DOCUMENTO as readonly string[]).includes(valor);
}

/** Normaliza el número: sin espacios extremos y en mayúsculas. */
export function normalizarNumeroDocumento(numero: string): string {
  return numero.trim().toUpperCase();
}

/** True si el número es válido para el tipo indicado. */
export function validarNumeroDocumento(
  tipo: TipoDocumento,
  numero: string,
): boolean {
  const patron = PATRONES[tipo];
  if (!patron) {
    return false;
  }
  return patron.test(normalizarNumeroDocumento(numero));
}
