import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { SociosModule } from "../socios/socios.module";
import { CobroSocio } from "./cobro-socio.entity";
import { CobrosSocioController } from "./cobros-socio.controller";
import { CobrosSocioJob } from "./cobros-socio-job.service";
import { CobrosSocioService } from "./cobros-socio.service";
import { ConversacionSocio } from "./conversacion-socio.entity";
import { LinkPago } from "./link-pago.entity";
import { MensajeSocio } from "./mensaje-socio.entity";
import { NotificacionesSocioService } from "./notificaciones-socio.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CobroSocio, LinkPago, ConversacionSocio, MensajeSocio, Ruta]),
    SociosModule,
    JwtModule.register({}),
  ],
  controllers: [CobrosSocioController],
  providers: [CobrosSocioService, CobrosSocioJob, NotificacionesSocioService],
  exports: [CobrosSocioService, NotificacionesSocioService],
})
export class CobrosSocioModule {}