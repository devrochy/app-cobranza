import { IsEnum, IsOptional, IsString } from "class-validator";
import { SOCIO_ESTATUS, SocioEstatus } from "../socio.entity";

export class ListarSociosDto {
  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsEnum(SOCIO_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus?: SocioEstatus;
}