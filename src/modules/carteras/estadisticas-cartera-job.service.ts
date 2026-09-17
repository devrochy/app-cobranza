import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { EstadisticasCarteraService } from "./estadisticas-cartera.service";

/**
 * Job de cierre de día: persiste el snapshot de estadísticas de todas las
 * carteras para poder comparar contra el día anterior. Si el job no corre, el
 * endpoint calcula el día actual al vuelo y compara contra el último snapshot.
 */
@Injectable()
export class EstadisticasCarteraJobService {
  private readonly logger = new Logger(EstadisticasCarteraJobService.name);

  constructor(private readonly estadisticas: EstadisticasCarteraService) {}

  @Cron("0 55 23 * * *")
  async handleCron(): Promise<void> {
    const fecha = this.estadisticas.fechaDeHoy();
    const guardadas = await this.estadisticas.persistirTodasLasCarteras(fecha);
    this.logger.log(`Estadísticas: snapshot de ${guardadas} cartera(s) para ${fecha}`);
  }
}
