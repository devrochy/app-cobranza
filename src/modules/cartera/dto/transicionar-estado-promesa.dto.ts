import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class TransicionarEstadoPromesaDto {
  @IsIn(["cumplida", "incumplida"], { message: "estado debe ser cumplida o incumplida" })
  estado!: "cumplida" | "incumplida";

  @IsString()
  @IsNotEmpty({ message: "el motivo es obligatorio" })
  motivo!: string;
}