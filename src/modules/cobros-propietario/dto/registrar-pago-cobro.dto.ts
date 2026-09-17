import { IsDateString, IsIn, IsNumber, IsOptional, Min } from "class-validator";
import { METODO_PAGO } from "../../../domain/metodo-pago";

export class RegistrarPagoCobroDto {
  @IsNumber({}, { message: "montoPagado debe ser un número" })
  @Min(1, { message: "montoPagado debe ser mayor a 0" })
  montoPagado!: number;

  @IsIn(METODO_PAGO, { message: "El método de pago no es válido" })
  metodoPago!: (typeof METODO_PAGO)[number];

  @IsOptional()
  @IsDateString({}, { message: "fechaPago debe ser una fecha válida" })
  fechaPago?: string;
}