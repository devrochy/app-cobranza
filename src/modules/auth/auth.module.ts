import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { toPositiveInt } from "../../config/db-options";
import { SecurityModule } from "../security/security.module";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Gestor } from "../gestores/gestor.entity";
import { GestoresModule } from "../gestores/gestores.module";
import { Propietario } from "../propietarios/propietario.entity";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { Device } from "../sincronizacion-offline/device.entity";
import { SincronizacionOfflineModule } from "../sincronizacion-offline/sincronizacion-offline.module";
import { RefreshTokenRevocado } from "./refresh-token-revocado.entity";
import { RefreshTokenPurgeService } from "./refresh-token-purge.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GestorPermisoGuard } from "./gestor-permiso.guard";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermisoGuard } from "./permiso.guard";

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: "login",
            ttl: toPositiveInt(config.get<string>("AUTH_THROTTLE_TTL_MS"), 60000),
            limit: toPositiveInt(config.get<string>("AUTH_THROTTLE_LIMIT"), 5),
            // Un solo contador por IP para los tres endpoints de login.
            generateKey: (_context, tracker) => `login:${tracker}`,
          },
        ],
      }),
    }),
    TypeOrmModule.forFeature([AdminUser, Propietario, Gestor, Device, RefreshTokenRevocado]),
    JwtModule.register({}),
    SecurityModule,
    PropietariosModule,
    GestoresModule,
    SincronizacionOfflineModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenPurgeService, JwtAuthGuard, PermisoGuard, GestorPermisoGuard],
  exports: [AuthService, JwtModule, TypeOrmModule, PermisoGuard, GestorPermisoGuard],
})
export class AuthModule {}
