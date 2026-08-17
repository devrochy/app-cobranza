import { ValueTransformer } from "typeorm";

/**
 * Transformer compartido para columnas `numeric` de Postgres: convierte el
 * valor string devuelto por el driver a number al leer, y lo mantiene como
 * number al escribir. Evita duplicarlo en cada entidad.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number.parseFloat(value),
};
