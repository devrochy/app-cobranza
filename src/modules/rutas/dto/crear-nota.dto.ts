import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CrearNotaDto {
  @IsString()
  @IsNotEmpty({ message: "La nota es obligatoria" })
  @Matches(/\S/, { message: "La nota no puede estar vacía" })
  @MaxLength(5000, { message: "La nota no puede superar 5000 caracteres" })
  nota!: string;
}