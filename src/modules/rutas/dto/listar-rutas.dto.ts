import { IsEnum, IsOptional, IsString } from "class-validator";
import { RUTA_ESTATUS, RutaEstatus } from "../ruta.entity";

export class ListarRutasDto {
  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsEnum(RUTA_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus?: RutaEstatus;
}