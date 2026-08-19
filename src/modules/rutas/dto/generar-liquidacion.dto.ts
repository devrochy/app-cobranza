import { IsOptional, IsString } from "class-validator";

export class GenerarLiquidacionDto {
  @IsOptional()
  @IsString()
  comentario?: string | null;
}