/**
 * Códigos de error de PostgreSQL usados en la capa de servicios.
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const UNIQUE_VIOLATION = "23505";

/** true si el error es una violación de unicidad de Postgres (código 23505). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}
