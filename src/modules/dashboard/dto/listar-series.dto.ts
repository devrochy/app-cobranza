import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class ListarSeriesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "rutaId debe ser un id válido" })
  @Min(1, { message: "rutaId debe ser un id válido" })
  rutaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "socioId debe ser un id válido" })
  @Min(1, { message: "socioId debe ser un id válido" })
  socioId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "dias debe ser un entero" })
  @Min(1, { message: "dias debe ser al menos 1" })
  @Max(90, { message: "dias no puede superar 90" })
  dias?: number;
}
