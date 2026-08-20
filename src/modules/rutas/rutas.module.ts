import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { SociosModule } from "../socios/socios.module";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { RutaConfigService } from "./ruta-config.service";
import { Inyeccion } from "./inyeccion.entity";
import { InyeccionesService } from "./inyecciones.service";
import { Caja } from "./caja.entity";
import { CajaAjusteLog } from "./caja-ajuste-log.entity";
import { CajaService } from "./caja.service";
import { Gasto } from "./gasto.entity";
import { GastoEvidencia } from "./gasto-evidencia.entity";
import { GastosService } from "./gastos.service";
import { RutaNota } from "./ruta-nota.entity";
import { RutasNotasService } from "./rutas-notas.service";
import { Liquidacion } from "./liquidacion.entity";
import { LiquidacionesService } from "./liquidaciones.service";
import { RutasResumenService } from "./rutas-resumen.service";
import { RutaOptimizadaLog } from "./ruta-optimizada-log.entity";
import { RutaOptimizacionService } from "./ruta-optimizacion.service";
import { ListaClientesDelDiaService } from "./lista-clientes-dia.service";
import { RutasController } from "./rutas.controller";
import { RutasService } from "./rutas.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta, RutaConfig, Inyeccion, Caja, CajaAjusteLog, Gasto, GastoEvidencia, RutaNota, Liquidacion, RutaOptimizadaLog, Socio, Cobrador]),
    SecurityModule,
    JwtModule.register({}),
    SociosModule,
  ],
  controllers: [RutasController],
  providers: [RutasService, RutaConfigService, InyeccionesService, CajaService, GastosService, RutasNotasService, LiquidacionesService, RutasResumenService, RutaOptimizacionService, ListaClientesDelDiaService],
  exports: [RutasService, CajaService],
})
export class RutasModule {}
