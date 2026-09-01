import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { AplicarEventosOfflineService } from "./aplicar-eventos-offline.service";
import { Device } from "./device.entity";

/**
 * Reintentos de eventos offline `pendiente`/`error` que quedaron sin aplicar
 * (p. ej. errores transitorios de red/validación al momento del ingest).
 */
@Injectable()
export class AplicarOfflineJob {
  private readonly logger = new Logger(AplicarOfflineJob.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly aplicarService: AplicarEventosOfflineService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reintentarPendientes(): Promise<void> {
    const devices = await this.deviceRepo.find({
      where: { estado: "activo", rutaId: Not(IsNull()) },
    });
    for (const device of devices) {
      try {
        await this.aplicarService.aplicarPendientesDeDispositivo(device);
      } catch (err) {
        this.logger.warn(
          `Reintento fallido para el dispositivo ${device.id}: ${String(err)}`,
        );
      }
    }
  }
}