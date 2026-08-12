import { Validate } from "class-validator";
import { SOCIO_PERMISOS } from "../socio-permiso.entity";
import { MatrizPermisosValidaConstraint } from "./permisos-validos.constraint";

export class UpdatePermisosDto {
  @Validate(MatrizPermisosValidaConstraint, [SOCIO_PERMISOS])
  matriz!: Record<string, boolean>;
}
