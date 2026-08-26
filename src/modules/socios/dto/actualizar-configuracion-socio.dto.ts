import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class ActualizarConfiguracionSocioDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pais?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombreOficinaCobro?: string;

  @IsOptional()
  @IsInt({ message: "diasToleranciaCobro debe ser un número entero" })
  @Min(0, { message: "diasToleranciaCobro debe ser mayor o igual a 0" })
  diasToleranciaCobro?: number;

  @IsOptional()
  @IsInt({ message: "diasAnticipacionCobro debe ser un número entero" })
  @Min(0, { message: "diasAnticipacionCobro debe ser mayor o igual a 0" })
  diasAnticipacionCobro?: number;
}