import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { SOCIO_PERMISOS } from "../socio-permiso.entity";

@ValidatorConstraint({ name: "matrizPermisosValida", async: false })
export class MatrizPermisosValidaConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    return Object.entries(value as Record<string, unknown>).every(
      ([key, habilitado]) =>
        (SOCIO_PERMISOS as readonly string[]).includes(key) &&
        typeof habilitado === "boolean",
    );
  }

  defaultMessage(): string {
    return "La matriz debe contener solo permisos válidos con valores booleanos";
  }
}
