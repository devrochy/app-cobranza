import { IsEnum, IsOptional, IsString } from "class-validator";
import { PROPIETARIO_ESTATUS, PropietarioEstatus } from "../propietario.entity";

export class ListarPropietariosDto {
  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsEnum(PROPIETARIO_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus?: PropietarioEstatus;
}