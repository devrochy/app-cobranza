export const DEFAULT_RETRY_ATTEMPTS = 10;
export const DEFAULT_RETRY_DELAY_MS = 3000;

export type EnvGetter = (key: string, defaultValue?: string) => string | undefined;

export interface DbConnectionOptions {
  type: "postgres";
  url: string | undefined;
  autoLoadEntities: boolean;
  synchronize: boolean;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Construye las opciones de conexión de TypeORM.
 * `retryAttempts`/`retryDelay` son parametrizables por env (TYPEORM_RETRY_ATTEMPTS,
 * TYPEORM_RETRY_DELAY) para permitir fail-fast en pruebas e2e cuando la BD no está
 * disponible, en lugar de la tormenta de reintentos default (10 x 3s por cada app boot).
 */
export function buildTypeOrmOptions(get: EnvGetter): DbConnectionOptions {
  const retryAttempts = toPositiveInt(
    get("TYPEORM_RETRY_ATTEMPTS"),
    DEFAULT_RETRY_ATTEMPTS,
  );
  const retryDelay = toPositiveInt(get("TYPEORM_RETRY_DELAY"), DEFAULT_RETRY_DELAY_MS);

  return {
    type: "postgres",
    url: get("DATABASE_URL"),
    autoLoadEntities: true,
    synchronize: get("NODE_ENV") !== "production",
    retryAttempts,
    retryDelay,
  };
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}