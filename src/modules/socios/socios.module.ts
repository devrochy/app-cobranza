import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { Socio } from "./socio.entity";
import { SociosController } from "./socios.controller";
import { SociosService } from "./socios.service";

@Module({
  imports: [TypeOrmModule.forFeature([Socio]), SecurityModule, JwtModule.register({})],
  controllers: [SociosController],
  providers: [SociosService],
  exports: [TypeOrmModule, SociosService],
})
export class SociosModule {}
