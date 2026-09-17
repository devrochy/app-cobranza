import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { PermisosPropietarioService } from "./permisos-propietario.service";
import { PropietarioPermiso } from "./propietario-permiso.entity";
import { Propietario } from "./propietario.entity";
import { PropietariosController } from "./propietarios.controller";
import { PropietariosService } from "./propietarios.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Propietario, PropietarioPermiso]),
    SecurityModule,
    JwtModule.register({}),
  ],
  controllers: [PropietariosController],
  providers: [PropietariosService, PermisosPropietarioService],
  exports: [TypeOrmModule, PropietariosService, PermisosPropietarioService],
})
export class PropietariosModule {}
