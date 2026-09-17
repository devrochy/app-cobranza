import { IsInt, IsPositive } from "class-validator";

export class ReasignarGestorDto {
  @IsInt()
  @IsPositive({ message: "gestorId debe ser un id válido" })
  gestorId!: number;
}
