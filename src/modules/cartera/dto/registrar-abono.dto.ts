import { IsIn, IsInt, IsNumber, IsPositive } from "class-validator";
import { METODO_PAGO } from "../../../domain/metodo-pago";

export class RegistrarAbonoDto {
  @IsInt()
  @IsPositive({ message: "prestamoId debe ser un id válido" })
  prestamoId!: number;

  @IsNumber({}, { message: "El valor debe ser un número" })
  @IsPositive({ message: "El valor debe ser mayor que 0" })
  valor!: number;

  @IsIn(METODO_PAGO, { message: "El método de pago no es válido" })
  metodoPago!: (typeof METODO_PAGO)[number];
}
