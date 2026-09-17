import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Cartera } from "../carteras/cartera.entity";
import { Cuota } from "../clientes/cuota.entity";
import { Prestamo } from "../clientes/prestamo.entity";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { GestoresModule } from "../gestores/gestores.module";
import { CarterasModule } from "../carteras/carteras.module";
import { ClientesModule } from "../clientes/clientes.module";
import { SecurityModule } from "../security/security.module";
import { Device } from "../sincronizacion-offline/device.entity";
import { TestDataSeedService } from "./test-data.seed.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, Propietario, Gestor, Cartera, Cuota, Prestamo, Device]),
    PropietariosModule,
    GestoresModule,
    CarterasModule,
    ClientesModule,
    SecurityModule,
  ],
  providers: [TestDataSeedService],
})
export class TestDataModule {}