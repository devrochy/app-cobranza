import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsPositive, IsString, Max, Min } from "class-validator";

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

  @Type(() => Number)
  @IsNumber({}, { message: "La latitud debe ser un número" })
  @Min(-90, { message: "La latitud no es válida" })
  @Max(90, { message: "La latitud no es válida" })
  latitud!: number;

  @Type(() => Number)
  @IsNumber({}, { message: "La longitud debe ser un número" })
  @Min(-180, { message: "La longitud no es válida" })
  @Max(180, { message: "La longitud no es válida" })
  longitud!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "El tope máximo de deuda debe ser un número" })
  @IsPositive({ message: "El tope máximo de deuda debe ser mayor que 0" })
  topeMaximoDeuda?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "La latitud del domicilio debe ser un número" })
  @Min(-90, { message: "La latitud del domicilio no es válida" })
  @Max(90, { message: "La latitud del domicilio no es válida" })
  latitudDomicilio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "La longitud del domicilio debe ser un número" })
  @Min(-180, { message: "La longitud del domicilio no es válida" })
  @Max(180, { message: "La longitud del domicilio no es válida" })
  longitudDomicilio?: number;
}
