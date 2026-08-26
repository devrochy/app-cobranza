import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Abono } from "../cartera/abono.entity";
import { Cliente } from "../cartera/cliente.entity";
import { ConversacionIa } from "../cartera/conversacion-ia.entity";
import { Cuota } from "../cartera/cuota.entity";
import { Pago } from "../cartera/pago.entity";
import { Prestamo } from "../cartera/prestamo.entity";
import { Gasto } from "../rutas/gasto.entity";
import { Liquidacion } from "../rutas/liquidacion.entity";
import { Ruta } from "../rutas/ruta.entity";
import { SociosModule } from "../socios/socios.module";
import { Socio } from "../socios/socio.entity";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { MonitoreoIaService } from "./monitoreo-ia.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prestamo,
      Cuota,
      Pago,
      Abono,
      Gasto,
      Liquidacion,
      Ruta,
      Socio,
      Cliente,
      ConversacionIa,
    ]),
    JwtModule.register({}),
    SociosModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, MonitoreoIaService],
})
export class DashboardModule {}