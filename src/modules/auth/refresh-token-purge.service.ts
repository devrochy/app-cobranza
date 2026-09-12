import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { RefreshTokenRevocado } from "./refresh-token-revocado.entity";

/**
 * Purga diaria de la blacklist de refresh tokens: elimina las entradas ya
 * expiradas, que dejan de ser necesarias (su JWT ya no es válido
 * criptográficamente). Evita que `refresh_token_revocados` crezca sin límite.
 */
@Injectable()
export class RefreshTokenPurgeService {
  private readonly logger = new Logger(RefreshTokenPurgeService.name);

  constructor(
    @InjectRepository(RefreshTokenRevocado)
    private readonly revocadoRepo: Repository<RefreshTokenRevocado>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron(): Promise<void> {
    const borrados = await this.purgar(new Date());
    this.logger.log(`Refresh tokens revocados purgados: ${borrados}`);
  }

  async purgar(ahora: Date = new Date()): Promise<number> {
    const resultado = await this.revocadoRepo.delete({
      expiraEn: LessThan(ahora),
    });
    return resultado.affected ?? 0;
  }
}
