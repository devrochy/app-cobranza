import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { AdminUser } from "../admin-users/admin-user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser]),
    JwtModule.register({}),
    SecurityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule, TypeOrmModule],
})
export class AuthModule {}
