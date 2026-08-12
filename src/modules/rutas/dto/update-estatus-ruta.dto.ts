import { IsEnum } from "class-validator";
import { RUTA_ESTATUS, RutaEstatus } from "../ruta.entity";

export class UpdateEstatusRutaDto {
  @IsEnum(RUTA_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus!: RutaEstatus;
}
