import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsPositive, IsString } from "class-validator";

export class RegistrarGastoDto {
  @IsString()
  @IsNotEmpty({ message: "La descripción es obligatoria" })
  descripcion!: string;

  @Type(() => Number)
  @IsNumber({}, { message: "El valor debe ser un número" })
  @IsPositive({ message: "El valor debe ser mayor que 0" })
  valor!: number;
}
