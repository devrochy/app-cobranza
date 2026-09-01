export type OrigenesCors = boolean | string[] | false;

/**
 * Resuelve la configuración de CORS.
 * - Si `CORS_ORIGINS` está definido (comma-separated) → whitelist exacta.
 * - En producción sin `CORS_ORIGINS` → false (sin cross-origin).
 * - En desarrollo → true (permitir todos, conveniente para el APK web local).
 */
export function resolverOrigenesCors(
  corsOriginsEnv: string | undefined,
  nodeEnv = "development",
): OrigenesCors {
  if (corsOriginsEnv) {
    return corsOriginsEnv
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  if (nodeEnv === "production") {
    return false;
  }
  return true;
}