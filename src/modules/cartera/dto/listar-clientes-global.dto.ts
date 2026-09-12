import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
