import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class ListarDashboardDto {
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
}