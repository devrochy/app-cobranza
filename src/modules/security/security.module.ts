import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { HttpsGuard } from "./https.guard";
import { PasswordService } from "./password.service";

@Module({
  providers: [
    HttpsGuard,
    PasswordService,
    { provide: APP_GUARD, useClass: HttpsGuard },
  ],
  exports: [HttpsGuard, PasswordService],
})
export class SecurityModule {}
