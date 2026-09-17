import { IsString, MinLength } from "class-validator";

export class OperacionAuditadaDto {
  @IsString()
  @MinLength(1, { message: "La contraseña es obligatoria" })
  password!: string;

  @IsString()
  @MinLength(1, { message: "El motivo es obligatorio" })
  motivo!: string;
}