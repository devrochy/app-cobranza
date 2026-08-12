import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { SociosModule } from "../socios/socios.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermisoGuard } from "./permiso.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, Socio]),
    JwtModule.register({}),
    SecurityModule,
    SociosModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermisoGuard],
  exports: [AuthService, JwtModule, TypeOrmModule, PermisoGuard],
})
export class AuthModule {}
