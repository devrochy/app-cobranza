import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { CobradoresModule } from "../cobradores/cobradores.module";
import { Socio } from "../socios/socio.entity";
import { SociosModule } from "../socios/socios.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CobradorPermisoGuard } from "./cobrador-permiso.guard";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermisoGuard } from "./permiso.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, Socio, Cobrador]),
    JwtModule.register({}),
    SecurityModule,
    SociosModule,
    CobradoresModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermisoGuard, CobradorPermisoGuard],
  exports: [AuthService, JwtModule, TypeOrmModule, PermisoGuard, CobradorPermisoGuard],
})
export class AuthModule {}
