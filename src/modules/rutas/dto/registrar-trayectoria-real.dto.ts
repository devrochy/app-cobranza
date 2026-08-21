import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, Max, Min, ValidateNested } from "class-validator";

export class PuntoGeoDto {
  @Type(() => Number)
  @IsNumber({}, { message: "latitud debe ser un número" })
  @Min(-90, { message: "latitud inválida" })
  @Max(90, { message: "latitud inválida" })
  latitud!: number;

  @Type(() => Number)
  @IsNumber({}, { message: "longitud debe ser un número" })
  @Min(-180, { message: "longitud inválida" })
  @Max(180, { message: "longitud inválida" })
  longitud!: number;
}

export class RegistrarTrayectoriaRealDto {
  // Un LineString GeoJSON exige >= 2 posiciones (RFC 7946 §3.1.4).
  @IsArray({ message: "puntos debe ser un array" })
  @ArrayMinSize(2, { message: "puntos debe tener al menos 2 posiciones" })
  @ValidateNested({ each: true })
  @Type(() => PuntoGeoDto)
  puntos!: PuntoGeoDto[];
}