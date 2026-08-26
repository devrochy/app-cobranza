import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class RegistrarDispositivoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "rutaId debe ser un id válido" })
  rutaId?: number;
}