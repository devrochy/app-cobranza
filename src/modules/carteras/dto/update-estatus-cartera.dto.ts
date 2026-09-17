import { IsEnum } from "class-validator";
import { CARTERA_ESTATUS, CarteraEstatus } from "../cartera.entity";

export class UpdateEstatusCarteraDto {
  @IsEnum(CARTERA_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus!: CarteraEstatus;
}
