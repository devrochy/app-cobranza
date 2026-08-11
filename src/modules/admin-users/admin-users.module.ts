import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { AdminUser } from "./admin-user.entity";
import { AdminUserSeedService } from "./admin-users.seed.service";

@Module({
  imports: [TypeOrmModule.forFeature([AdminUser]), SecurityModule],
  providers: [AdminUserSeedService],
  exports: [TypeOrmModule],
})
export class AdminUsersModule {}
