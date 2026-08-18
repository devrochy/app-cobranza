import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { Cuota } from "./cuota.entity";

/**
 * Job diario de mora (HU-13/HU-15/HU-16).
 * Marca como "atrasada" toda cuota "pendiente" cuyo vencimiento (ajustado) sea
 * anterior al día actual. Alimenta el conteo que usa el color de riesgo.
 * Nota de zona horaria: la comparación se hace en UTC; se documenta como
 * limitación a confirmar si la operación usa otra zona.
 */
@Injectable()
export class MoraJobService {
  private readonly logger = new Logger(MoraJobService.name);

  constructor(
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
  ) {}

  @Cron("0 0 2 * * *")
  async handleCron(): Promise<void> {
    const marcadas = await this.ejecutar(new Date());
    this.logger.log(`Mora: ${marcadas} cuota(s) marcada(s) como atrasada(s)`);
  }

  async ejecutar(hoy: Date = new Date()): Promise<number> {
    const fechaHoy = formatDate(hoy);

    const vencidas = await this.cuotaRepo.find({
      where: {
        estatus: "pendiente",
        fechaVencimiento: LessThan(fechaHoy),
      },
    });

    if (vencidas.length === 0) {
      return 0;
    }

    const marcadas = vencidas.map((cuota) => ({
      ...cuota,
      estatus: "atrasada" as const,
    }));
    await this.cuotaRepo.save(marcadas);

    return marcadas.length;
  }
}
