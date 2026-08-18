import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { SociosModule } from "../socios/socios.module";
import { RutasModule } from "../rutas/rutas.module";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { CarteraController } from "./cartera.controller";
import { ClienteService } from "./cliente.service";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { PrestamoService } from "./prestamo.service";
import { MoraJobService } from "./mora-job.service";
import { Pago } from "./pago.entity";
import { Abono } from "./abono.entity";
import { PagosService } from "./pagos.service";
import { AbonosService } from "./abonos.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, Prestamo, Cuota, Pago, Abono, Ruta, RutaConfig]),
    SecurityModule,
    JwtModule.register({}),
    SociosModule,
    RutasModule,
  ],
  controllers: [CarteraController],
  providers: [ClienteService, PrestamoService, MoraJobService, PagosService, AbonosService],
  exports: [TypeOrmModule],
})
export class CarteraModule {}
