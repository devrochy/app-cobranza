import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { SociosModule } from "../socios/socios.module";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Ruta } from "./ruta.entity";
import { RutasController } from "./rutas.controller";
import { RutasService } from "./rutas.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta, Socio, Cobrador]),
    SecurityModule,
    JwtModule.register({}),
    SociosModule,
  ],
  controllers: [RutasController],
  providers: [RutasService],
  exports: [RutasService],
})
export class RutasModule {}
