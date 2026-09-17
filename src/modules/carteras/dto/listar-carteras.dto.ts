import { IsEnum, IsOptional, IsString } from "class-validator";
import { CARTERA_ESTATUS, CarteraEstatus } from "../cartera.entity";

export class ListarCarterasDto {
  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsEnum(CARTERA_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus?: CarteraEstatus;
}