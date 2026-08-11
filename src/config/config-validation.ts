const REQUIRED_ENV_KEYS = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"] as const;

/**
 * Valida que las variables de entorno críticas tengan valor real.
 * Fail-fast en arranque: un secret vacío produce tokens inválidos en runtime
 * (error 500 oscuro) o, peor, tokens firmados con secreto trivial.
 */
export function validateRequiredEnv(
  config: Record<string, string | undefined>,
): string[] {
  return REQUIRED_ENV_KEYS.filter((key) => {
    const value = config[key];
    return value === undefined || value.trim() === "";
  });
}
