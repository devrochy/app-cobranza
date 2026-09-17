import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsPositive,
  IsString,
  MinLength,
} from "class-validator";
import { GESTOR_ESTATUS, GestorEstatus } from "../gestor.entity";

export class CreateGestorDto {
  @IsInt()
  @IsPositive({ message: "propietarioId debe ser un id de propietario válido" })
  propietarioId!: number;

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

  @IsOptional()
  @IsEnum(GESTOR_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus?: GestorEstatus;
}
