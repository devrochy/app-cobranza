import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { NotificacionesService } from "./notificaciones.service";

/**
 * Job diario de notificaciones (Fase 4, ítem 23): agenda los recordatorios de
 * pago pre-vencimiento vía el motor de notificaciones. El `diasAnticipacion`
 * por ruta se conecta en HU-52; por ahora se usa un default global.
 */
@Injectable()
export class NotificacionesJob {
  private readonly logger = new Logger(NotificacionesJob.name);

  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Cron("0 30 7 * * *")
  async handleCron(): Promise<void> {
    const enviadas = await this.notificacionesService.ejecutarRecordatorios({
      diasAnticipacion: 3,
    });
    this.logger.log(`Notificaciones job: ${enviadas} recordatorio(s) enviado(s)`);
  }
}