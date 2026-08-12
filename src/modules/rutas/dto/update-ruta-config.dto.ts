import { IsInt, IsNumber, IsOptional, IsPositive, Min } from "class-validator";

export class UpdateRutaConfigDto {
  @IsOptional()
  @IsNumber({}, { message: "El tipo de interés debe ser un número" })
  @IsPositive({ message: "El tipo de interés debe ser mayor que 0" })
  tipoInteres?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: "El número de cuotas debe ser al menos 1" })
  numCuotas?: number;
}
