import { IsInt, IsPositive } from "class-validator";

export class ReasignarCobradorDto {
  @IsInt()
  @IsPositive({ message: "cobradorId debe ser un id válido" })
  cobradorId!: number;
}
