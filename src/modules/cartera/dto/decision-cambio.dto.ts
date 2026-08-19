import { IsIn, IsOptional, IsString } from "class-validator";

export class DecisionCambioDto {
  @IsIn(["aprobar", "rechazar"], { message: "La decisión debe ser aprobar o rechazar" })
  decision!: "aprobar" | "rechazar";

  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}
