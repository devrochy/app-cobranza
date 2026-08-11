import { IsEnum } from "class-validator";
import { SOCIO_ESTATUS, SocioEstatus } from "../socio.entity";

export class UpdateEstatusDto {
  @IsEnum(SOCIO_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus!: SocioEstatus;
}
