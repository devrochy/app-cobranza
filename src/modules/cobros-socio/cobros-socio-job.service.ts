import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CobrosSocioService } from "./cobros-socio.service";
import { NotificacionesSocioService } from "./notificaciones-socio.service";
import { SocioMoraService } from "./socio-mora.service";

/**
 * Job diario de cobro a socios (HU-60/HU-61): genera los cobros del día (cuando
 * el día coincide con la generación según la anticipación), marca como vencidos
 * los cobros pendientes ya vencidos, bloquea a los socios en mora (HU-61) y
 * dispara el ciclo de notificaciones (recordatorio/aviso/alerta).
 */
@Injectable()
export class CobrosSocioJob {
  private readonly logger = new Logger(CobrosSocioJob.name);

  constructor(
    private readonly cobrosSocioService: CobrosSocioService,
    private readonly notificacionesSocioService: NotificacionesSocioService,
    private readonly socioMoraService: SocioMoraService,
  ) {}

  @Cron("0 30 2 * * *")
  async handleCron(): Promise<void> {
    const creados = await this.cobrosSocioService.generarCobrosDelDia();
    const vencidos = await this.cobrosSocioService.marcarVencidos();
    const bloqueados = await this.socioMoraService.bloquearMorosos();
    await this.notificacionesSocioService.ejecutarCiclo();
    this.logger.log(
      `Cobros socio: ${creados} generado(s), ${vencidos} vencido(s), ${bloqueados} socio(s) bloqueado(s) por mora`,
    );
  }
}