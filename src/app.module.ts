import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RequestLoggingInterceptor } from "./common/request-logging.interceptor";
import { buildTypeOrmOptions } from "./config/db-options";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ClientesModule } from "./modules/clientes/clientes.module";
import { CobrosPropietarioModule } from "./modules/cobros-propietario/cobros-propietario.module";
import { GestoresModule } from "./modules/gestores/gestores.module";
import { GestorModule } from "./modules/gestor/gestor.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthModule } from "./modules/health/health.module";
import { MetricsModule } from "./modules/metrics/metrics.module";
import { PerfilModule } from "./modules/perfil/perfil.module";
import { CarterasModule } from "./modules/carteras/carteras.module";
import { ReglasNegociacionIaModule } from "./modules/reglas-negociacion-ia/reglas-negociacion-ia.module";
import { SecurityModule } from "./modules/security/security.module";
import { SincronizacionOfflineModule } from "./modules/sincronizacion-offline/sincronizacion-offline.module";
import { PropietariosModule } from "./modules/propietarios/propietarios.module";
import { TestDataModule } from "./modules/test-data/test-data.module";
import { ImportarCarteraModule } from "./modules/importar-cartera/importar-cartera.module";

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
    PropietariosModule,
    GestoresModule,
    GestorModule,
    CarterasModule,
    ClientesModule,
    CobrosPropietarioModule,
    ReglasNegociacionIaModule,
    SincronizacionOfflineModule,
    DashboardModule,
    HealthModule,
    MetricsModule,
    PerfilModule,
    TestDataModule,
    ImportarCarteraModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
