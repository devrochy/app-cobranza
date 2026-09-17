import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { Propietario } from "../propietarios/propietario.entity";
import { CarterasModule } from "../carteras/carteras.module";
import { Gestor } from "./gestor.entity";
import { GestorPermiso } from "./gestor-permiso.entity";
import { GestoresController } from "./gestores.controller";
import { GestoresPermisosService } from "./gestores-permisos.service";
import { GestoresService } from "./gestores.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Gestor, Propietario, GestorPermiso]),
    SecurityModule,
    JwtModule.register({}),
    PropietariosModule,
    CarterasModule,
  ],
  controllers: [GestoresController],
  providers: [GestoresService, GestoresPermisosService],
  exports: [TypeOrmModule, GestoresService, GestoresPermisosService],
})
export class GestoresModule {}
