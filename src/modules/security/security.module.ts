import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { HttpsGuard } from "./https.guard";
import { PasswordService } from "./password.service";
import { ReautenticacionService } from "./reautenticacion.service";

@Module({
  imports: [TypeOrmModule.forFeature([AdminUser, Socio])],
  providers: [
    HttpsGuard,
    PasswordService,
    ReautenticacionService,
    { provide: APP_GUARD, useClass: HttpsGuard },
  ],
  exports: [HttpsGuard, PasswordService, ReautenticacionService],
})
export class SecurityModule {}
