import { IsDateString, IsOptional, IsPositive } from "class-validator";
import { OperacionAuditadaDto } from "./operacion-auditada.dto";

export class EditarCuotaDto extends OperacionAuditadaDto {
  @IsOptional()
  @IsPositive({ message: "El valor de la cuota debe ser mayor que 0" })
  valorEsperado?: number;

  @IsOptional()
  @IsDateString({}, { message: "fechaVencimiento debe ser una fecha válida" })
  fechaVencimiento?: string;
}