import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { SociosService } from "../socios/socios.service";
import { CobroSocio } from "./cobro-socio.entity";

/**
 * Bloqueo automático por mora de cobro (HU-61): bloquea a un Socio cuando
 * tiene cualquier cobro sin pagar cuyo retraso supere `dias_tolerancia_cobro`
 * tras su `fecha_vencimiento`, y lo re-activa al pagar si ya no queda morosidad.
 * El bloqueo/re-activación usa `SociosService.setEstatus` (cascada HU-05) y el
 * efecto es inmediato gracias a la revalidación de estatus del JwtAuthGuard.
 */
@Injectable()
export class SocioMoraService {
  constructor(
    @InjectRepository(CobroSocio)
    private readonly cobroRepo: Repository<CobroSocio>,
    private readonly sociosService: SociosService,
  ) {}

  async bloquearMorosos(hoy: Date = new Date()): Promise<number> {
    const cobros = await this.cobroRepo.find({
      where: { estado: Not("pagado") },
      relations: { socio: true },
    });

    const sociosMorosos = new Set<number>();
    for (const cobro of cobros) {
      if (cobro.estado === "pagado") continue;
      const socio = cobro.socio;
      if (!socio || socio.estatus !== "activo") continue;
      if (this.esMoroso(cobro.fechaVencimiento, socio.diasToleranciaCobro ?? 0, hoy)) {
        sociosMorosos.add(socio.id);
      }
    }

    let bloqueados = 0;
    for (const socioId of sociosMorosos) {
      await this.sociosService.setEstatus(socioId, "bloqueado");
      bloqueados += 1;
    }
    return bloqueados;
  }

  async habilitarSiSinMorosidad(socioId: number, hoy: Date = new Date()): Promise<boolean> {
    const socio = await this.sociosService.obtener(socioId);
    if (socio.estatus !== "bloqueado") {
      return false;
    }

    const cobros = await this.cobroRepo.find({
      where: { socio: { id: socioId }, estado: Not("pagado") },
    });
    const sigueMoroso = cobros.some((cobro) =>
      this.esMoroso(cobro.fechaVencimiento, socio.diasToleranciaCobro ?? 0, hoy),
    );
    if (sigueMoroso) {
      return false;
    }

    await this.sociosService.setEstatus(socioId, "activo");
    return true;
  }

  private esMoroso(fechaVencimiento: string, diasTolerancia: number, hoy: Date): boolean {
    const vencimiento = new Date(`${fechaVencimiento}T00:00:00Z`);
    vencimiento.setUTCDate(vencimiento.getUTCDate() + diasTolerancia);
    return formatDate(vencimiento) < formatDate(hoy);
  }
}