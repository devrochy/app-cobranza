import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { SociosModule } from "../socios/socios.module";
import { CobradoresModule } from "../cobradores/cobradores.module";
import { RutasModule } from "../rutas/rutas.module";
import { CarteraModule } from "../cartera/cartera.module";
import { TestDataSeedService } from "./test-data.seed.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser]),
    SociosModule,
    CobradoresModule,
    RutasModule,
    CarteraModule,
  ],
  providers: [TestDataSeedService],
})
export class TestDataModule {}