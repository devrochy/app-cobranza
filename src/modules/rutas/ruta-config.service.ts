import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { PeriodoLiquidacion } from "../../domain/liquidacion";
import { Ruta } from "./ruta.entity";
import { DiasNoLaborables, RutaConfig } from "./ruta-config.entity";

export interface RutaConfigPublic {
  rutaId: number;
  cuotasMinimasPrestamo: number;
  cuotasAtrasoUmbral: number;
  manejoCupoActivo: boolean;
  cupoDefault: number;
  recargoActivo: boolean;
  bloquearCambioInteres: boolean;
  comisionActiva: boolean;
  comisionPorcentaje: number;
  mostrarFechaUltimaLiquidada: boolean;
  mostrarCaja: boolean;
  mostrarCobradoLiquidada: boolean;
  mostrarPrestamos: boolean;
  eliminarPrestamosApk: boolean;
  reconocimientoFacialActivo: boolean;
  registroDocumentoCliente: boolean;
  eliminarPagosApk: boolean;
  eliminarGastosApk: boolean;
  eliminarInyeccionApk: boolean;
  eliminarAbonosApk: boolean;
  registrarInyeccionApk: boolean;
  generarReportesApk: boolean;
  ocultarCartera: boolean;
  mostrarCobroEstimado: boolean;
  bloqueoAutomaticoClientes: boolean;
  permitirCambioFechaPrestamo: boolean;
  borrarClientesSinDeuda: boolean;
  diasNoLaborables: DiasNoLaborables;
  periodoLiquidacion: PeriodoLiquidacion;
  diasAnticipacionNotificacion: number;
  avisoDiaCobro: boolean;
  umbralMoraNotificacion: number;
}

export type RutaConfigInput = Partial<Omit<RutaConfigPublic, "rutaId">>;

const RUTA_CONFIG_DEFAULTS: Omit<RutaConfigPublic, "rutaId"> = {
  cuotasMinimasPrestamo: 0,
  cuotasAtrasoUmbral: 1,
  manejoCupoActivo: false,
  cupoDefault: 0,
  recargoActivo: false,
  bloquearCambioInteres: false,
  comisionActiva: false,
  comisionPorcentaje: 0,
  mostrarFechaUltimaLiquidada: false,
  mostrarCaja: false,
  mostrarCobradoLiquidada: false,
  mostrarPrestamos: false,
  eliminarPrestamosApk: false,
  reconocimientoFacialActivo: false,
  registroDocumentoCliente: false,
  eliminarPagosApk: false,
  eliminarGastosApk: false,
  eliminarInyeccionApk: false,
  eliminarAbonosApk: false,
  registrarInyeccionApk: false,
  generarReportesApk: false,
  ocultarCartera: false,
  mostrarCobroEstimado: false,
  bloqueoAutomaticoClientes: false,
  permitirCambioFechaPrestamo: false,
  borrarClientesSinDeuda: false,
  diasNoLaborables: "solo_domingos" as const,
  periodoLiquidacion: "diario" as const,
  diasAnticipacionNotificacion: 0,
  avisoDiaCobro: false,
  umbralMoraNotificacion: 0,
};

export const RutaConfigDefaults = RUTA_CONFIG_DEFAULTS;

const CAMPO_KEYS = Object.keys(RUTA_CONFIG_DEFAULTS);

export interface RequesterConfigContext {
  rol: RolUsuario;
  sub: number;
}



@Injectable()
export class RutaConfigService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaConfig)
    private readonly configRepo: Repository<RutaConfig>,
  ) {}

  async getMatriz(rutaId: number, requester: RequesterConfigContext): Promise<RutaConfigPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const fila = await this.configRepo.findOne({ where: { ruta: { id: rutaId } } });
    if (!fila) {
      return { rutaId, ...RUTA_CONFIG_DEFAULTS };
    }
    return this.toPublic(fila, rutaId);
  }

  async setMatriz(
    rutaId: number,
    input: RutaConfigInput,
    requester: RequesterConfigContext,
  ): Promise<RutaConfigPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const clavesInvalidas = Object.keys(input ?? {}).filter(
      (key) => !(CAMPO_KEYS as readonly string[]).includes(key),
    );
    if (clavesInvalidas.length > 0) {
      throw new BadRequestException(
        `Parámetros inválidos: ${clavesInvalidas.join(", ")}`,
      );
    }

    const existente = await this.configRepo.findOne({ where: { ruta: { id: rutaId } } });
    let base: RutaConfig;
    if (existente) {
      // PUT = reemplazo total: reset a defaults conservadores y aplicar el input
      // (claves ausentes vuelven al default, consistente con socio_permisos).
      Object.assign(existente, RUTA_CONFIG_DEFAULTS, input);
      base = existente;
    } else {
      base = this.configRepo.create({
        ruta: { id: rutaId } as Ruta,
        rutaId,
        ...RUTA_CONFIG_DEFAULTS,
        ...input,
      });
    }

    const saved = await this.configRepo.save(base);
    return this.toPublic(saved, rutaId);
  }

  private toPublic(fila: RutaConfig, rutaId: number): RutaConfigPublic {
    return {
      rutaId,
      cuotasMinimasPrestamo: fila.cuotasMinimasPrestamo,
      cuotasAtrasoUmbral: fila.cuotasAtrasoUmbral,
      manejoCupoActivo: fila.manejoCupoActivo,
      cupoDefault: fila.cupoDefault,
      recargoActivo: fila.recargoActivo,
      bloquearCambioInteres: fila.bloquearCambioInteres,
      comisionActiva: fila.comisionActiva,
      comisionPorcentaje: fila.comisionPorcentaje,
      mostrarFechaUltimaLiquidada: fila.mostrarFechaUltimaLiquidada,
      mostrarCaja: fila.mostrarCaja,
      mostrarCobradoLiquidada: fila.mostrarCobradoLiquidada,
      mostrarPrestamos: fila.mostrarPrestamos,
      eliminarPrestamosApk: fila.eliminarPrestamosApk,
      reconocimientoFacialActivo: fila.reconocimientoFacialActivo,
      registroDocumentoCliente: fila.registroDocumentoCliente,
      eliminarPagosApk: fila.eliminarPagosApk,
      eliminarGastosApk: fila.eliminarGastosApk,
      eliminarInyeccionApk: fila.eliminarInyeccionApk,
      eliminarAbonosApk: fila.eliminarAbonosApk,
      registrarInyeccionApk: fila.registrarInyeccionApk,
      generarReportesApk: fila.generarReportesApk,
      ocultarCartera: fila.ocultarCartera,
      mostrarCobroEstimado: fila.mostrarCobroEstimado,
      bloqueoAutomaticoClientes: fila.bloqueoAutomaticoClientes,
      permitirCambioFechaPrestamo: fila.permitirCambioFechaPrestamo,
      borrarClientesSinDeuda: fila.borrarClientesSinDeuda,
      diasNoLaborables: fila.diasNoLaborables,
      periodoLiquidacion: fila.periodoLiquidacion,
      diasAnticipacionNotificacion: fila.diasAnticipacionNotificacion,
      avisoDiaCobro: fila.avisoDiaCobro,
      umbralMoraNotificacion: fila.umbralMoraNotificacion,
    };
  }
}
