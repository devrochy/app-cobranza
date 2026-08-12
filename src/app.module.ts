import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CobradoresModule } from "./modules/cobradores/cobradores.module";
import { HealthModule } from "./modules/health/health.module";
import { RutasModule } from "./modules/rutas/rutas.module";
import { SecurityModule } from "./modules/security/security.module";
import { SociosModule } from "./modules/socios/socios.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        url: configService.get<string>("DATABASE_URL"),
        autoLoadEntities: true,
        synchronize: configService.get<string>("NODE_ENV") !== "production",
      }),
    }),
    AdminUsersModule,
    AuthModule,
    SecurityModule,
    SociosModule,
    CobradoresModule,
    RutasModule,
    HealthModule,
  ],
})
export class AppModule {}
