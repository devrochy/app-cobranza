import { IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from "class-validator";

export class CreatePrestamoDto {
  @IsInt()
  @IsPositive({ message: "clienteId debe ser un id válido" })
  clienteId!: number;

  @IsNumber({}, { message: "El valor debe ser un número" })
  @IsPositive({ message: "El valor debe ser mayor que 0" })
  valor!: number;

  @IsInt()
  @Min(1, { message: "El número de cuotas debe ser al menos 1" })
  numCuotas!: number;

  @IsOptional()
  @IsNumber({}, { message: "El tipo de interés debe ser un número" })
  @IsPositive({ message: "El tipo de interés debe ser mayor que 0" })
  tipoInteres?: number;

  @IsInt()
  @Min(1, { message: "Los días entre cuotas deben ser al menos 1" })
  diasEntreCuotas!: number;

  @IsNumber({}, { message: "La latitud debe ser un número" })
  @Min(-90, { message: "La latitud no es válida" })
  @Max(90, { message: "La latitud no es válida" })
  latitud!: number;

  @IsNumber({}, { message: "La longitud debe ser un número" })
  @Min(-180, { message: "La longitud no es válida" })
  @Max(180, { message: "La longitud no es válida" })
  longitud!: number;
}
