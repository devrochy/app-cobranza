import { IsEnum } from "class-validator";
import { PROPIETARIO_ESTATUS, PropietarioEstatus } from "../propietario.entity";

export class UpdateEstatusDto {
  @IsEnum(PROPIETARIO_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus!: PropietarioEstatus;
}
