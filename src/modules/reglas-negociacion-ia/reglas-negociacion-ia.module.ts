import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { SociosModule } from "../socios/socios.module";
import { ReglaNegociacionIa } from "./regla-negociacion-ia.entity";
import { ReglasNegociacionIaController } from "./reglas-negociacion-ia.controller";
import { ReglasNegociacionIaService } from "./reglas-negociacion-ia.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([ReglaNegociacionIa]),
    SecurityModule,
    JwtModule.register({}),
    SociosModule,
  ],
  controllers: [ReglasNegociacionIaController],
  providers: [ReglasNegociacionIaService],
  exports: [TypeOrmModule, ReglasNegociacionIaService],
})
export class ReglasNegociacionIaModule {}
