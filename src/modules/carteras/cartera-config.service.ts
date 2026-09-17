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
import { Cartera } from "./cartera.entity";
import { DiasNoLaborables, CarteraConfig } from "./cartera-config.entity";

export interface CarteraConfigPublic {
  carteraId: number;
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
  rutaHabilitada: boolean;
  diasNoLaborables: DiasNoLaborables;
  periodoLiquidacion: PeriodoLiquidacion;
  diasAnticipacionNotificacion: number;
  avisoDiaCobro: boolean;
  umbralMoraNotificacion: number;
}

export type CarteraConfigInput = Partial<Omit<CarteraConfigPublic, "carteraId">>;

const CARTERA_CONFIG_DEFAULTS: Omit<CarteraConfigPublic, "carteraId"> = {
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
  rutaHabilitada: false,
  diasNoLaborables: "solo_domingos" as const,
  periodoLiquidacion: "diario" as const,
  diasAnticipacionNotificacion: 0,
  avisoDiaCobro: false,
  umbralMoraNotificacion: 0,
};

export const CarteraConfigDefaults = CARTERA_CONFIG_DEFAULTS;

const CAMPO_KEYS = Object.keys(CARTERA_CONFIG_DEFAULTS);

export interface RequesterConfigContext {
  rol: RolUsuario;
  sub: number;
}



@Injectable()
export class CarteraConfigService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(CarteraConfig)
    private readonly configRepo: Repository<CarteraConfig>,
  ) {}

  async getMatriz(carteraId: number, requester: RequesterConfigContext): Promise<CarteraConfigPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const fila = await this.configRepo.findOne({ where: { cartera: { id: carteraId } } });
    if (!fila) {
      return { carteraId, ...CARTERA_CONFIG_DEFAULTS };
    }
    return this.toPublic(fila, carteraId);
  }

  async setMatriz(
    carteraId: number,
    input: CarteraConfigInput,
    requester: RequesterConfigContext,
  ): Promise<CarteraConfigPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const clavesInvalidas = Object.keys(input ?? {}).filter(
      (key) => !(CAMPO_KEYS as readonly string[]).includes(key),
    );
    if (clavesInvalidas.length > 0) {
      throw new BadRequestException(
        `Parámetros inválidos: ${clavesInvalidas.join(", ")}`,
      );
    }

    const existente = await this.configRepo.findOne({ where: { cartera: { id: carteraId } } });
    let base: CarteraConfig;
    if (existente) {
      // PUT = reemplazo total: reset a defaults conservadores y aplicar el input
      // (claves ausentes vuelven al default, consistente con propietario_permisos).
      Object.assign(existente, CARTERA_CONFIG_DEFAULTS, input);
      base = existente;
    } else {
      base = this.configRepo.create({
        cartera: { id: carteraId } as Cartera,
        carteraId,
        ...CARTERA_CONFIG_DEFAULTS,
        ...input,
      });
    }

    const saved = await this.configRepo.save(base);
    return this.toPublic(saved, carteraId);
  }

  private toPublic(fila: CarteraConfig, carteraId: number): CarteraConfigPublic {
    return {
      carteraId,
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
      rutaHabilitada: fila.rutaHabilitada,
      diasNoLaborables: fila.diasNoLaborables,
      periodoLiquidacion: fila.periodoLiquidacion,
      diasAnticipacionNotificacion: fila.diasAnticipacionNotificacion,
      avisoDiaCobro: fila.avisoDiaCobro,
      umbralMoraNotificacion: fila.umbralMoraNotificacion,
    };
  }
}
