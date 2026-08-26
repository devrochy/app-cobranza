import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from "class-validator";

export class EventoSincronizacionDto {
  @IsString()
  @IsNotEmpty()
  eventoIdCliente!: string;

  @IsString()
  @IsNotEmpty()
  tipoEvento!: string;

  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, unknown>;
}

export class SincronizarEventosDto {
  @IsNotEmpty()
  @ArrayMaxSize(500, { message: "El lote no puede superar 500 eventos" })
  @ValidateNested({ each: true })
  @Type(() => EventoSincronizacionDto)
  eventos!: EventoSincronizacionDto[];
}