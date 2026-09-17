import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { SecurityModule } from "../security/security.module";
import { PerfilController } from "./perfil.controller";
import { PerfilService } from "./perfil.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, Gestor, Propietario]),
    JwtModule.register({}),
    SecurityModule,
  ],
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}
