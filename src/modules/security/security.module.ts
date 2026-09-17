import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { HttpsGuard } from "./https.guard";
import { PasswordService } from "./password.service";
import { ReautenticacionService } from "./reautenticacion.service";

@Module({
  imports: [TypeOrmModule.forFeature([AdminUser, Propietario, Gestor])],
  providers: [
    HttpsGuard,
    PasswordService,
    ReautenticacionService,
    { provide: APP_GUARD, useClass: HttpsGuard },
  ],
  exports: [HttpsGuard, PasswordService, ReautenticacionService],
})
export class SecurityModule {}
