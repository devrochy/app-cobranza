import { Type } from "class-transformer";
import { IsNumber, Max, Min } from "class-validator";

export class RegistrarPosicionDto {
  @Type(() => Number)
  @IsNumber({}, { message: "latitud debe ser un número" })
  @Min(-90, { message: "latitud inválida" })
  @Max(90, { message: "latitud inválida" })
  latitud!: number;

  @Type(() => Number)
  @IsNumber({}, { message: "longitud debe ser un número" })
  @Min(-180, { message: "longitud inválida" })
  @Max(180, { message: "longitud inválida" })
  longitud!: number;
}