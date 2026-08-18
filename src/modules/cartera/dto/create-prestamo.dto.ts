import { IsInt, IsNumber, IsOptional, IsPositive, Min } from "class-validator";

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
}
