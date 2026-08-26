import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Matches } from "class-validator";
import { COBRO_SOCIO_ESTADO, CobroSocioEstado } from "../cobro-socio.entity";

export class ListarCobrosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  socioId?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: "periodo debe tener formato YYYY-MM" })
  periodo?: string;

  @IsOptional()
  @IsIn(COBRO_SOCIO_ESTADO, { message: "estado no es válido" })
  estado?: CobroSocioEstado;
}