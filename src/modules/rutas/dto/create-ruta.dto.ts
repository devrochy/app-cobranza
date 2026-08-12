import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from "class-validator";

export class CreateRutaDto {
  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsInt()
  @IsPositive({ message: "socioId debe ser un id válido" })
  socioId!: number;

  @IsInt()
  @IsPositive({ message: "cobradorId debe ser un id válido" })
  cobradorId!: number;

  @IsNumber({}, { message: "El tipo de interés debe ser un número" })
  @IsPositive({ message: "El tipo de interés debe ser mayor que 0" })
  tipoInteres!: number;

  @IsInt()
  @Min(1, { message: "El número de cuotas debe ser al menos 1" })
  numCuotas!: number;

  @Matches(/^[A-Z]{3}$/, {
    message: "La moneda debe ser un código ISO 4217 de 3 letras",
  })
  moneda!: string;
}
