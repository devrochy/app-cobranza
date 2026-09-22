import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { Cliente } from "../clientes/cliente.entity";
import { Prestamo } from "../clientes/prestamo.entity";
import { Cuota } from "../clientes/cuota.entity";
import { Pago } from "../clientes/pago.entity";
import { ImportarCarteraService } from "./importar-cartera.service";
import { ImportarCarteraController } from "./importar-cartera.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Cartera, Cliente, Prestamo, Cuota, Pago])],
  controllers: [ImportarCarteraController],
  providers: [ImportarCarteraService],
  exports: [ImportarCarteraService],
})
export class ImportarCarteraModule {}
