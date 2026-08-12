import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { PermisosSocioService } from "./permisos-socio.service";
import { SocioPermiso } from "./socio-permiso.entity";
import { Socio } from "./socio.entity";
import { SociosController } from "./socios.controller";
import { SociosService } from "./socios.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Socio, SocioPermiso]),
    SecurityModule,
    JwtModule.register({}),
  ],
  controllers: [SociosController],
  providers: [SociosService, PermisosSocioService],
  exports: [TypeOrmModule, SociosService, PermisosSocioService],
})
export class SociosModule {}
