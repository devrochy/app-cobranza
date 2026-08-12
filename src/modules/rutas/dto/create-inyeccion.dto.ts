import { IsNotEmpty, IsNumber, IsPositive, IsString, Matches } from "class-validator";

export class CreateInyeccionDto {
  @IsNumber({}, { message: "El valor debe ser un número" })
  @IsPositive({ message: "El valor debe ser mayor que 0" })
  valor!: number;

  @IsString()
  @IsNotEmpty({ message: "El comentario es obligatorio" })
  @Matches(/\S/, { message: "El comentario no puede estar vacío" })
  comentario!: string;
}
