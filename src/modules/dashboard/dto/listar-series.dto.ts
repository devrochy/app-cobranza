import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class ListarSeriesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "carteraId debe ser un id válido" })
  @Min(1, { message: "carteraId debe ser un id válido" })
  carteraId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "propietarioId debe ser un id válido" })
  @Min(1, { message: "propietarioId debe ser un id válido" })
  propietarioId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "dias debe ser un entero" })
  @Min(1, { message: "dias debe ser al menos 1" })
  @Max(90, { message: "dias no puede superar 90" })
  dias?: number;
}
