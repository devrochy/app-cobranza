/**
 * Redacción de datos sensibles para logs de diagnóstico: PII de clientes,
 * credenciales/tokens y montos. Además, omite artefactos de BD (`query`,
 * `parameters`) para no filtrar SQL ni valores en los logs.
 */
export const CLAVES_SENSIBLES: readonly string[] = [
  "password",
  "passwordActual",
  "passwordNueva",
  "passwordHash",
  "accessToken",
  "refreshToken",
  "token",
  "telefono",
  "telefonoWhatsapp",
  "correo",
  "nombre",
  "apellido",
  "numeroDocumento",
  "valor",
  "monto",
  "montoPagado",
  "montoCalculado",
  "valorEsperado",
  "saldoPendiente",
];

export const CLAVES_BD: readonly string[] = ["query", "parameters", "driverError"];

const REDACTADO = "[redactado]";
const OMITIDO = "[omitido]";

/**
 * Devuelve una copia de `valor` con los campos sensibles redactados (recursivo
 * en objetos y arrays). Los valores primitivos se devuelven tal cual.
 */
export function redactarSensibles(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(redactarSensibles);
  }
  if (valor !== null && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (CLAVES_SENSIBLES.includes(clave)) {
        salida[clave] = REDACTADO;
      } else if (CLAVES_BD.includes(clave)) {
        salida[clave] = OMITIDO;
      } else {
        salida[clave] = redactarSensibles(v);
      }
    }
    return salida;
  }
  return valor;
}
