import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CobrosSocioService } from "./cobros-socio.service";
import { NotificacionesSocioService } from "./notificaciones-socio.service";

/**
 * Job diario de cobro a socios (HU-60): genera los cobros del día (cuando el día
 * coincide con el vencimiento anclado al alta del socio), marca como vencidos
 * los cobros pendientes ya vencidos y dispara el ciclo de notificaciones
 * (recordatorio/aviso/alerta).
 */
@Injectable()
export class CobrosSocioJob {
  private readonly logger = new Logger(CobrosSocioJob.name);

  constructor(
    private readonly cobrosSocioService: CobrosSocioService,
    private readonly notificacionesSocioService: NotificacionesSocioService,
  ) {}

  @Cron("0 30 2 * * *")
  async handleCron(): Promise<void> {
    const creados = await this.cobrosSocioService.generarCobrosDelDia();
    const vencidos = await this.cobrosSocioService.marcarVencidos();
    await this.notificacionesSocioService.ejecutarCiclo();
    this.logger.log(
      `Cobros socio: ${creados} generado(s), ${vencidos} marcado(s) como vencido(s)`,
    );
  }
}