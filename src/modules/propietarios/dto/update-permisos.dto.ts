import { Validate } from "class-validator";
import { PROPIETARIO_PERMISOS } from "../propietario-permiso.entity";
import { MatrizPermisosValidaConstraint } from "./permisos-validos.constraint";

export class UpdatePermisosDto {
  @Validate(MatrizPermisosValidaConstraint, [PROPIETARIO_PERMISOS])
  matriz!: Record<string, boolean>;
}
