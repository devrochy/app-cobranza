import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateCarteraDto {
  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;
}
