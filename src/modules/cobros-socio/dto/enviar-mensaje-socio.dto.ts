import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class EnviarMensajeSocioDto {
  @IsString()
  @IsNotEmpty({ message: "El contenido es obligatorio" })
  @Matches(/\S/, { message: "El contenido no puede estar vacío" })
  @MaxLength(2000, { message: "El contenido es demasiado largo" })
  contenido!: string;
}