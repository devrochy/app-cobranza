import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { Propietario } from "../propietarios/propietario.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Cartera } from "./cartera.entity";
import { CarteraConfig } from "./cartera-config.entity";
import { CarteraConfigService } from "./cartera-config.service";
import { Inyeccion } from "./inyeccion.entity";
import { InyeccionesService } from "./inyecciones.service";
import { Caja } from "./caja.entity";
import { CajaAjusteLog } from "./caja-ajuste-log.entity";
import { CajaService } from "./caja.service";
import { Gasto } from "./gasto.entity";
import { GastoEvidencia } from "./gasto-evidencia.entity";
import { GastosService } from "./gastos.service";
import { CarteraNota } from "./cartera-nota.entity";
import { CarterasNotasService } from "./carteras-notas.service";
import { Liquidacion } from "./liquidacion.entity";
import { LiquidacionesService } from "./liquidaciones.service";
import { CarteraEstadisticasSnapshot } from "./cartera-estadisticas-snapshot.entity";
import { EstadisticasCarteraService } from "./estadisticas-cartera.service";
import { ReportesDiariosService } from "./reportes-diarios.service";
import { EstadisticasCarteraJobService } from "./estadisticas-cartera-job.service";
import { CarterasResumenService } from "./carteras-resumen.service";
import { CarteraOptimizadaLog } from "./cartera-optimizada-log.entity";
import { CarteraOptimizacionService } from "./cartera-optimizacion.service";
import { ListaClientesDelDiaService } from "./lista-clientes-dia.service";
import { ReporteDiario } from "./reporte-diario.entity";
import { TrayectoriasService } from "./trayectorias.service";
import { CarteraApertura } from "./cartera-apertura.entity";
import { CarterasAperturaService } from "./carteras-apertura.service";
import { PosicionGestor } from "./posicion-gestor.entity";
import { PosicionGestorService } from "./posicion-gestor.service";
import { CarterasController } from "./carteras.controller";
import { ReportesGlobalController } from "./reportes-global.controller";
import { CarterasService } from "./carteras.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cartera, CarteraConfig, Inyeccion, Caja, CajaAjusteLog, Gasto, GastoEvidencia, CarteraNota, Liquidacion, CarteraOptimizadaLog, ReporteDiario, CarteraApertura, PosicionGestor, CarteraEstadisticasSnapshot, Propietario, Gestor]),
    SecurityModule,
    JwtModule.register({}),
    PropietariosModule,
  ],
  controllers: [CarterasController, ReportesGlobalController],
  providers: [CarterasService, CarteraConfigService, InyeccionesService, CajaService, GastosService, CarterasNotasService, LiquidacionesService, CarterasResumenService, EstadisticasCarteraService, EstadisticasCarteraJobService, ReportesDiariosService, CarteraOptimizacionService, ListaClientesDelDiaService, TrayectoriasService, CarterasAperturaService, PosicionGestorService],
  exports: [CarterasService, CarteraConfigService, InyeccionesService, GastosService, CarterasNotasService, LiquidacionesService, EstadisticasCarteraService, ReportesDiariosService, TrayectoriasService, CajaService, ListaClientesDelDiaService, CarteraOptimizacionService, CarterasAperturaService, PosicionGestorService],
})
export class CarterasModule {}
