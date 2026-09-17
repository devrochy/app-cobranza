import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MinLength,
} from "class-validator";
import { PROPIETARIO_ESTATUS, PropietarioEstatus } from "../propietario.entity";

export class CreatePropietarioDto {
  @IsString()
  @IsNotEmpty({ message: "El usuario es obligatorio" })
  usuario!: string;

  @IsString()
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: "El apellido es obligatorio" })
  apellido!: string;

  @IsEmail({}, { message: "El correo no es válido" })
  correo!: string;

  @IsPhoneNumber(undefined, { message: "El teléfono no es válido" })
  telefono!: string;

  @IsString()
  @IsNotEmpty({ message: "El código es obligatorio" })
  codigo!: string;

  @Matches(/^[A-Z]{3}$/, {
    message: "La moneda debe ser un código ISO 4217 de 3 letras",
  })
  moneda!: string;

  @IsOptional()
  @IsEnum(PROPIETARIO_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus?: PropietarioEstatus;
}
