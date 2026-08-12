import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { SociosModule } from "../socios/socios.module";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "./cobrador.entity";
import { CobradorPermiso } from "./cobrador-permiso.entity";
import { CobradoresController } from "./cobradores.controller";
import { CobradoresPermisosService } from "./cobradores-permisos.service";
import { CobradoresService } from "./cobradores.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cobrador, Socio, CobradorPermiso]),
    SecurityModule,
    JwtModule.register({}),
    SociosModule,
  ],
  controllers: [CobradoresController],
  providers: [CobradoresService, CobradoresPermisosService],
  exports: [TypeOrmModule, CobradoresService, CobradoresPermisosService],
})
export class CobradoresModule {}
