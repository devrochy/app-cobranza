import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { CobroPropietario } from "./cobro-propietario.entity";
import { CobrosPropietarioController } from "./cobros-propietario.controller";
import { CobrosPropietarioJob } from "./cobros-propietario-job.service";
import { CobrosPropietarioService } from "./cobros-propietario.service";
import { ConversacionesPropietarioController } from "./conversaciones-propietario.controller";
import { ConversacionPropietarioChatService } from "./conversacion-propietario-chat.service";
import { ConversacionPropietario } from "./conversacion-propietario.entity";
import { LinkPago } from "./link-pago.entity";
import { MensajePropietario } from "./mensaje-propietario.entity";
import { NotificacionesPropietarioService } from "./notificaciones-propietario.service";
import { PropietarioMoraService } from "./propietario-mora.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CobroPropietario, LinkPago, ConversacionPropietario, MensajePropietario, Cartera]),
    PropietariosModule,
    JwtModule.register({}),
  ],
controllers: [CobrosPropietarioController, ConversacionesPropietarioController],
  providers: [CobrosPropietarioService, CobrosPropietarioJob, NotificacionesPropietarioService, PropietarioMoraService, ConversacionPropietarioChatService],
  exports: [CobrosPropietarioService, NotificacionesPropietarioService],
})
export class CobrosPropietarioModule {}