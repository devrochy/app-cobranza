import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from "class-validator";

export class UpdateCobradorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "El nombre no puede estar vacío" })
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "El apellido no puede estar vacío" })
  apellido?: string;

  @IsOptional()
  @IsEmail({}, { message: "El correo no es válido" })
  correo?: string;

  @IsOptional()
  @IsPhoneNumber(undefined, { message: "El teléfono no es válido" })
  telefono?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  password?: string;
}
