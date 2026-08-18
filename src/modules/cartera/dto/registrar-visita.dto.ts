import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
} from "class-validator";
import { METODO_PAGO } from "../../../domain/metodo-pago";
import { MOTIVOS_NO_PAGO } from "../../../domain/motivos-no-pago";

export class RegistrarVisitaDto {
  @IsInt()
  @IsPositive({ message: "prestamoId debe ser un id válido" })
  prestamoId!: number;

  @IsInt()
  @IsPositive({ message: "clienteId debe ser un id válido" })
  clienteId!: number;

  @IsIn(["pago", "no_pago"], { message: "El resultado debe ser pago o no_pago" })
  resultado!: "pago" | "no_pago";

  @IsOptional()
  @IsIn(["cuota", "abono"], { message: "tipoPago debe ser cuota o abono" })
  tipoPago?: "cuota" | "abono";

  @IsOptional()
  @IsInt()
  @IsPositive({ message: "cuotaId debe ser un id válido" })
  cuotaId?: number;

  @IsOptional()
  @IsNumber({}, { message: "El valor debe ser un número" })
  @IsPositive({ message: "El valor debe ser mayor que 0" })
  valor?: number;

  @IsOptional()
  @IsIn(METODO_PAGO, { message: "El método de pago no es válido" })
  metodoPago?: (typeof METODO_PAGO)[number];

  @IsOptional()
  @IsIn(MOTIVOS_NO_PAGO, { message: "El motivo de no pago no es válido" })
  motivoNoPago?: (typeof MOTIVOS_NO_PAGO)[number];

  @IsOptional()
  @IsDateString({}, { message: "fechaPrometida debe ser una fecha válida (YYYY-MM-DD)" })
  fechaPrometida?: string;

  @IsOptional()
  @IsNumber({}, { message: "El valor prometido debe ser un número" })
  @IsPositive({ message: "El valor prometido debe ser mayor que 0" })
  valorPrometido?: number;
}
