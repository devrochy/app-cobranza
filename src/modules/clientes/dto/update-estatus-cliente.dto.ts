import { IsEnum } from "class-validator";
import { CLIENTE_ESTATUS, ClienteEstatus } from "../cliente.entity";

export class UpdateEstatusClienteDto {
  @IsEnum(CLIENTE_ESTATUS, { message: "El estatus debe ser activo o bloqueado" })
  estatus!: ClienteEstatus;
}