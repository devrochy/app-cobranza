import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Matches } from "class-validator";
import { COBRO_PROPIETARIO_ESTADO, CobroPropietarioEstado } from "../cobro-propietario.entity";

export class ListarCobrosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  propietarioId?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: "periodo debe tener formato YYYY-MM" })
  periodo?: string;

  @IsOptional()
  @IsIn(COBRO_PROPIETARIO_ESTADO, { message: "estado no es válido" })
  estado?: CobroPropietarioEstado;
}