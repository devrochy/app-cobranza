import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { SociosModule } from "../socios/socios.module";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { RutaConfigService } from "./ruta-config.service";
import { Inyeccion } from "./inyeccion.entity";
import { InyeccionesService } from "./inyecciones.service";
import { Caja } from "./caja.entity";
import { CajaAjusteLog } from "./caja-ajuste-log.entity";
import { CajaService } from "./caja.service";
import { RutasController } from "./rutas.controller";
import { RutasService } from "./rutas.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta, RutaConfig, Inyeccion, Caja, CajaAjusteLog, Socio, Cobrador]),
    SecurityModule,
    JwtModule.register({}),
    SociosModule,
  ],
  controllers: [RutasController],
  providers: [RutasService, RutaConfigService, InyeccionesService, CajaService],
  exports: [RutasService, CajaService],
})
export class RutasModule {}
