import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { NotificacionesService } from "./notificaciones.service";

/**
 * Job diario de notificaciones (Fase 4, ítems 23-24): dispara el ciclo completo
 * de notificaciones de pago de cuota. Recorre las rutas activas y, para cada
 * una, ejecuta el recordatorio pre-vencimiento, el aviso del día de cobro y la
 * alerta de mora según la config de la ruta (HU-52).
 */
@Injectable()
export class NotificacionesJob {
  private readonly logger = new Logger(NotificacionesJob.name);

  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  @Cron("0 30 7 * * *")
  async handleCron(): Promise<void> {
    const hoy = new Date();
    const rutas = await this.rutaRepo.find({ where: { estatus: "activo" } });

    let recordatorios = 0;
    let avisos = 0;
    let alertas = 0;

    for (const ruta of rutas) {
      recordatorios += await this.notificacionesService.ejecutarRecordatorios({ rutaId: ruta.id, hoy });
      avisos += await this.notificacionesService.ejecutarAvisoDiaCobro(ruta.id, { hoy });
      alertas += await this.notificacionesService.ejecutarAlertaMora(ruta.id, { hoy });
    }

    this.logger.log(
      `Notificaciones job: ${recordatorios} recordatorio(s), ${avisos} aviso(s) de día, ${alertas} alerta(s) de mora`,
    );
  }
}
