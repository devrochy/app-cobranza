import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CobrosPropietarioService } from "./cobros-propietario.service";
import { NotificacionesPropietarioService } from "./notificaciones-propietario.service";
import { PropietarioMoraService } from "./propietario-mora.service";

/**
 * Job diario de cobro a propietarios (HU-60/HU-61): genera los cobros del día (cuando
 * el día coincide con la generación según la anticipación), marca como vencidos
 * los cobros pendientes ya vencidos, bloquea a los propietarios en mora (HU-61) y
 * dispara el ciclo de notificaciones (recordatorio/aviso/alerta).
 */
@Injectable()
export class CobrosPropietarioJob {
  private readonly logger = new Logger(CobrosPropietarioJob.name);

  constructor(
    private readonly cobrosPropietarioService: CobrosPropietarioService,
    private readonly notificacionesPropietarioService: NotificacionesPropietarioService,
    private readonly propietarioMoraService: PropietarioMoraService,
  ) {}

  @Cron("0 30 2 * * *")
  async handleCron(): Promise<void> {
    const creados = await this.cobrosPropietarioService.generarCobrosDelDia();
    const vencidos = await this.cobrosPropietarioService.marcarVencidos();
    const bloqueados = await this.propietarioMoraService.bloquearMorosos();
    await this.notificacionesPropietarioService.ejecutarCiclo();
    this.logger.log(
      `Cobros propietario: ${creados} generado(s), ${vencidos} vencido(s), ${bloqueados} propietario(s) bloqueado(s) por mora`,
    );
  }
}