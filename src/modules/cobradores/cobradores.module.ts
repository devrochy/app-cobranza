import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "./cobrador.entity";
import { CobradoresController } from "./cobradores.controller";
import { CobradoresService } from "./cobradores.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cobrador, Socio]),
    SecurityModule,
    JwtModule.register({}),
  ],
  controllers: [CobradoresController],
  providers: [CobradoresService],
  exports: [TypeOrmModule, CobradoresService],
})
export class CobradoresModule {}
