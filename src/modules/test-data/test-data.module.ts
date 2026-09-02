import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Ruta } from "../rutas/ruta.entity";
import { Cuota } from "../cartera/cuota.entity";
import { Prestamo } from "../cartera/prestamo.entity";
import { SociosModule } from "../socios/socios.module";
import { CobradoresModule } from "../cobradores/cobradores.module";
import { RutasModule } from "../rutas/rutas.module";
import { CarteraModule } from "../cartera/cartera.module";
import { SecurityModule } from "../security/security.module";
import { Device } from "../sincronizacion-offline/device.entity";
import { TestDataSeedService } from "./test-data.seed.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, Socio, Cobrador, Ruta, Cuota, Prestamo, Device]),
    SociosModule,
    CobradoresModule,
    RutasModule,
    CarteraModule,
    SecurityModule,
  ],
  providers: [TestDataSeedService],
})
export class TestDataModule {}