import { IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString } from "class-validator";

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: "El apellido es obligatorio" })
  apellido!: string;

  @IsOptional()
  @IsString()
  negocio?: string;

  @IsPhoneNumber(undefined, { message: "El teléfono de WhatsApp no es válido" })
  telefonoWhatsapp!: string;

  @IsNumber({}, { message: "La latitud debe ser un número" })
  latitud!: number;

  @IsNumber({}, { message: "La longitud debe ser un número" })
  longitud!: number;
}
