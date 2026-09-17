import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "matrizPermisosValida", async: false })
export class MatrizPermisosValidaConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const catalogo = args.constraints[0] as readonly string[];
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    return Object.entries(value as Record<string, unknown>).every(
      ([key, habilitado]) =>
        catalogo.includes(key) && typeof habilitado === "boolean",
    );
  }

  defaultMessage(): string {
    return "La matriz debe contener solo permisos válidos con valores booleanos";
  }
}
