import { Type } from "class-transformer";
import { IsNumber, Min, Max } from "class-validator";

export class OrigenNavegacionDto {
  @Type(() => Number)
  @IsNumber({}, { message: "origenLat debe ser un número" })
  @Min(-90, { message: "origenLat inválido" })
  @Max(90, { message: "origenLat inválido" })
  origenLat!: number;

  @Type(() => Number)
  @IsNumber({}, { message: "origenLng debe ser un número" })
  @Min(-180, { message: "origenLng inválido" })
  @Max(180, { message: "origenLng inválido" })
  origenLng!: number;
}