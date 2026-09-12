import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, LessThan, Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { Cuota } from "./cuota.entity";
import { ColorRiesgoService } from "./color-riesgo.service";

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
    private readonly dataSource: DataSource,
    private readonly colorRiesgo: ColorRiesgoService,
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
      relations: { prestamo: { cliente: true, ruta: true } },
    });

    if (vencidas.length === 0) {
      return 0;
    }

    const marcadas = vencidas.map((cuota) => ({
      ...cuota,
      estatus: "atrasada" as const,
    }));

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Cuota).save(marcadas);

      // HU-13: recalcula el color de los clientes afectados (una vez por cliente/ruta).
      const procesados = new Set<string>();
      for (const cuota of marcadas) {
        const clienteId = cuota.prestamo?.cliente?.id;
        const rutaId = cuota.prestamo?.ruta?.id;
        if (!clienteId || !rutaId) {
          continue;
        }
        const clave = `${clienteId}:${rutaId}`;
        if (procesados.has(clave)) {
          continue;
        }
        procesados.add(clave);
        await this.colorRiesgo.recalcularSeguro(clienteId, rutaId, manager);
      }
    });

    return marcadas.length;
  }
}
