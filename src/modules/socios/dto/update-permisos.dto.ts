import { Validate } from "class-validator";
import { MatrizPermisosValidaConstraint } from "./permisos-validos.constraint";

export class UpdatePermisosDto {
  @Validate(MatrizPermisosValidaConstraint)
  matriz!: Record<string, boolean>;
}
