import { IsInt, IsPositive, Matches } from "class-validator";

export class GenerarCobroSocioDto {
  @IsInt()
  @IsPositive({ message: "socioId debe ser un id válido" })
  socioId!: number;

  @Matches(/^\d{4}-\d{2}$/, { message: "periodo debe tener formato YYYY-MM" })
  periodo!: string;
}