import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { ClientesModule } from "../clientes/clientes.module";
import { GestoresModule } from "../gestores/gestores.module";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { Cartera } from "../carteras/cartera.entity";
import { CarterasModule } from "../carteras/carteras.module";
import { GestorController } from "./gestor.controller";
import { GestorService } from "./gestor.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cartera]),
    ClientesModule,
    CarterasModule,
    GestoresModule,
    PropietariosModule,
    AuthModule,
  ],
  controllers: [GestorController],
  providers: [GestorService],
})
export class GestorModule {}