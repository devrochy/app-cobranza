import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from "class-validator";
import { DIAS_NO_LABORABLES } from "../ruta-config.entity";
import { PERIODO_LIQUIDACION, PeriodoLiquidacion } from "../../../domain/liquidacion";

export class UpdateRutaConfigMatrixDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: "Las cuotas mínimas de préstamo deben ser al menos 1" })
  cuotasMinimasPrestamo?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: "El umbral de cuotas en atraso debe ser al menos 1" })
  cuotasAtrasoUmbral?: number;

  @IsOptional()
  @IsBoolean()
  manejoCupoActivo?: boolean;

  @IsOptional()
  @IsNumber({}, { message: "El cupo por defecto debe ser un número" })
  @IsPositive({ message: "El cupo por defecto debe ser mayor que 0" })
  cupoDefault?: number;

  @IsOptional()
  @IsBoolean()
  recargoActivo?: boolean;

  @IsOptional()
  @IsBoolean()
  bloquearCambioInteres?: boolean;

  @IsOptional()
  @IsBoolean()
  comisionActiva?: boolean;

  @IsOptional()
  @IsNumber({}, { message: "La comisión debe ser un número" })
  @Min(0, { message: "La comisión no puede ser negativa" })
  @Max(100, { message: "La comisión no puede superar 100" })
  comisionPorcentaje?: number;

  @IsOptional()
  @IsBoolean()
  mostrarFechaUltimaLiquidada?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrarCaja?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrarCobradoLiquidada?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrarPrestamos?: boolean;

  @IsOptional()
  @IsBoolean()
  eliminarPrestamosApk?: boolean;

  @IsOptional()
  @IsBoolean()
  reconocimientoFacialActivo?: boolean;

  @IsOptional()
  @IsBoolean()
  registroDocumentoCliente?: boolean;

  @IsOptional()
  @IsBoolean()
  eliminarPagosApk?: boolean;

  @IsOptional()
  @IsBoolean()
  eliminarGastosApk?: boolean;

  @IsOptional()
  @IsBoolean()
  eliminarInyeccionApk?: boolean;

  @IsOptional()
  @IsBoolean()
  eliminarAbonosApk?: boolean;

  @IsOptional()
  @IsBoolean()
  registrarInyeccionApk?: boolean;

  @IsOptional()
  @IsBoolean()
  generarReportesApk?: boolean;

  @IsOptional()
  @IsBoolean()
  ocultarCartera?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrarCobroEstimado?: boolean;

  @IsOptional()
  @IsBoolean()
  bloqueoAutomaticoClientes?: boolean;

  @IsOptional()
  @IsBoolean()
  permitirCambioFechaPrestamo?: boolean;

  @IsOptional()
  @IsBoolean()
  borrarClientesSinDeuda?: boolean;

  @IsOptional()
  @IsIn(DIAS_NO_LABORABLES, {
    message: "diasNoLaborables debe ser solo_domingos o domingos_y_feriados",
  })
  diasNoLaborables?: (typeof DIAS_NO_LABORABLES)[number];

  @IsOptional()
  @IsIn(PERIODO_LIQUIDACION, {
    message: "periodoLiquidacion debe ser diario, semanal, quincenal o mensual",
  })
  periodoLiquidacion?: PeriodoLiquidacion;
}
