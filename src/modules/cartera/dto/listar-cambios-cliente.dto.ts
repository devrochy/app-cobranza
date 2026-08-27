import { IsEnum, IsOptional } from "class-validator";
import { CAMBIO_CLIENTE_ESTADO, CambioClienteEstado } from "../cambio-cliente-pendiente.entity";

export class ListarCambiosClienteDto {
  @IsOptional()
  @IsEnum(CAMBIO_CLIENTE_ESTADO, { message: "El estado no es válido" })
  estado?: CambioClienteEstado;
}