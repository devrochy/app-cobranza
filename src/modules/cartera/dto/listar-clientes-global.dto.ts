import { IsIn, IsOptional, IsString } from "class-validator";
import { CLIENTE_ESTATUS, ClienteEstatus } from "../cliente.entity";
import { COLOR_RIESGO, ColorRiesgo } from "../../../domain/color-riesgo";

export class ListarClientesGlobalDto {
  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsIn(CLIENTE_ESTATUS)
  estatus?: ClienteEstatus;

  @IsOptional()
  @IsIn(COLOR_RIESGO)
  colorRiesgo?: ColorRiesgo;
}