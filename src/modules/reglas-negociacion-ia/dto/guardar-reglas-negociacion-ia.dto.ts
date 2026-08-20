import { IsDefined, IsInt, IsNumber, Max, Min } from "class-validator";

export class GuardarReglasNegociacionIaDto {
  @IsDefined({ message: "maxDiasProrroga es obligatorio" })
  @IsInt()
  @Min(0, { message: "maxDiasProrroga debe ser mayor o igual a 0" })
  maxDiasProrroga!: number;

  @IsDefined({ message: "minAbonoAceptablePct es obligatorio" })
  @IsNumber({}, { message: "minAbonoAceptablePct debe ser un número" })
  @Min(0, { message: "minAbonoAceptablePct debe ser mayor o igual a 0" })
  @Max(100, { message: "minAbonoAceptablePct no puede superar 100" })
  minAbonoAceptablePct!: number;

  @IsDefined({ message: "maxReprogramacionesPorCliente es obligatorio" })
  @IsInt()
  @Min(0, { message: "maxReprogramacionesPorCliente debe ser mayor o igual a 0" })
  maxReprogramacionesPorCliente!: number;

  @IsDefined({ message: "umbralSaldoAutonomo es obligatorio" })
  @IsNumber({}, { message: "umbralSaldoAutonomo debe ser un número" })
  @Min(0, { message: "umbralSaldoAutonomo debe ser mayor o igual a 0" })
  umbralSaldoAutonomo!: number;
}
