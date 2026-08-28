import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class ListarDashboardDto {
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
}