import { Validate } from "class-validator";
import { COBRADOR_PERMISOS } from "../cobrador-permiso.entity";
import { MatrizPermisosValidaConstraint } from "../../socios/dto/permisos-validos.constraint";

export class UpdatePermisosCobradorDto {
  @Validate(MatrizPermisosValidaConstraint, [COBRADOR_PERMISOS])
  matriz!: Record<string, boolean>;
}
