import { IsNotEmpty, IsString } from "class-validator";

export class ActualizarPerfilDto {
  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: "El apellido es obligatorio" })
  apellido!: string;
}
