import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty({ message: "La contraseña actual es obligatoria" })
  passwordActual!: string;

  @IsString()
  @MinLength(8, { message: "La contraseña nueva debe tener al menos 8 caracteres" })
  passwordNueva!: string;
}
