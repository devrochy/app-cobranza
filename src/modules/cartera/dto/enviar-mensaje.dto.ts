import { IsNotEmpty, IsString } from "class-validator";

export class EnviarMensajeDto {
  @IsString()
  @IsNotEmpty({ message: "contenido es obligatorio" })
  contenido!: string;
}