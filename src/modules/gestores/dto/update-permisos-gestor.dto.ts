import { Validate } from "class-validator";
import { GESTOR_PERMISOS } from "../gestor-permiso.entity";
import { MatrizPermisosValidaConstraint } from "../../propietarios/dto/permisos-validos.constraint";

export class UpdatePermisosGestorDto {
  @Validate(MatrizPermisosValidaConstraint, [GESTOR_PERMISOS])
  matriz!: Record<string, boolean>;
}
