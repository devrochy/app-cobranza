import { IsInt, IsPositive, Matches } from "class-validator";

export class GenerarCobroPropietarioDto {
  @IsInt()
  @IsPositive({ message: "propietarioId debe ser un id válido" })
  propietarioId!: number;

  @Matches(/^\d{4}-\d{2}$/, { message: "periodo debe tener formato YYYY-MM" })
  periodo!: string;
}