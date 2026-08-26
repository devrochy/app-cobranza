import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { buildTypeOrmOptions } from "./config/db-options";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CarteraModule } from "./modules/cartera/cartera.module";
import { CobrosSocioModule } from "./modules/cobros-socio/cobros-socio.module";
import { CobradoresModule } from "./modules/cobradores/cobradores.module";
import { HealthModule } from "./modules/health/health.module";
import { RutasModule } from "./modules/rutas/rutas.module";
import { ReglasNegociacionIaModule } from "./modules/reglas-negociacion-ia/reglas-negociacion-ia.module";
import { SecurityModule } from "./modules/security/security.module";
import { SincronizacionOfflineModule } from "./modules/sincronizacion-offline/sincronizacion-offline.module";
import { SociosModule } from "./modules/socios/socios.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildTypeOrmOptions((key, defaultValue) => configService.get(key, defaultValue)),
    }),
    AdminUsersModule,
    AuthModule,
    SecurityModule,
    SociosModule,
    CobradoresModule,
    RutasModule,
    CarteraModule,
    CobrosSocioModule,
    ReglasNegociacionIaModule,
    SincronizacionOfflineModule,
    HealthModule,
  ],
})
export class AppModule {}
