import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Abono } from "../clientes/abono.entity";
import { Cliente } from "../clientes/cliente.entity";
import { ConversacionIa } from "../clientes/conversacion-ia.entity";
import { Cuota } from "../clientes/cuota.entity";
import { Pago } from "../clientes/pago.entity";
import { Prestamo } from "../clientes/prestamo.entity";
import { Gasto } from "../carteras/gasto.entity";
import { Liquidacion } from "../carteras/liquidacion.entity";
import { Cartera } from "../carteras/cartera.entity";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { Propietario } from "../propietarios/propietario.entity";
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
      Cartera,
      Propietario,
      Cliente,
      ConversacionIa,
    ]),
    JwtModule.register({}),
    PropietariosModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, MonitoreoIaService],
})
export class DashboardModule {}