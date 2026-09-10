import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";
import { PerfilController } from "./perfil.controller";
import { PerfilService } from "./perfil.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cobrador, Socio]),
    JwtModule.register({}),
  ],
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}
