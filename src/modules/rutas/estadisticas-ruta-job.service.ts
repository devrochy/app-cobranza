import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { EstadisticasRutaService } from "./estadisticas-ruta.service";

/**
 * Job de cierre de día: persiste el snapshot de estadísticas de todas las
 * rutas para poder comparar contra el día anterior. Si el job no corre, el
 * endpoint calcula el día actual al vuelo y compara contra el último snapshot.
 */
@Injectable()
export class EstadisticasRutaJobService {
  private readonly logger = new Logger(EstadisticasRutaJobService.name);

  constructor(private readonly estadisticas: EstadisticasRutaService) {}

  @Cron("0 55 23 * * *")
  async handleCron(): Promise<void> {
    const fecha = this.estadisticas.fechaDeHoy();
    const guardadas = await this.estadisticas.persistirTodasLasRutas(fecha);
    this.logger.log(`Estadísticas: snapshot de ${guardadas} ruta(s) para ${fecha}`);
  }
}
