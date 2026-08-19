import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString, Max, Min } from "class-validator";

export class ActualizarClienteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "El nombre no puede estar vacío" })
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "El apellido no puede estar vacío" })
  apellido?: string;

  @IsOptional()
  @IsString()
  negocio?: string | null;

  @IsOptional()
  @IsPhoneNumber(undefined, { message: "El teléfono de WhatsApp no es válido" })
  telefonoWhatsapp?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "La latitud debe ser un número" })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "La longitud debe ser un número" })
  @Min(-180)
  @Max(180)
  longitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "La latitud del domicilio debe ser un número" })
  @Min(-90)
  @Max(90)
  latitudDomicilio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "La longitud del domicilio debe ser un número" })
  @Min(-180)
  @Max(180)
  longitudDomicilio?: number;
}
