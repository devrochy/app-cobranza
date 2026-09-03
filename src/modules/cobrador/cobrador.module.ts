import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { CarteraModule } from "../cartera/cartera.module";
import { CobradoresModule } from "../cobradores/cobradores.module";
import { SociosModule } from "../socios/socios.module";
import { Ruta } from "../rutas/ruta.entity";
import { RutasModule } from "../rutas/rutas.module";
import { CobradorController } from "./cobrador.controller";
import { CobradorService } from "./cobrador.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta]),
    CarteraModule,
    RutasModule,
    CobradoresModule,
    SociosModule,
    AuthModule,
  ],
  controllers: [CobradorController],
  providers: [CobradorService],
})
export class CobradorModule {}