import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { PropietariosService } from "../propietarios/propietarios.service";
import { CobroPropietario } from "./cobro-propietario.entity";

/**
 * Bloqueo automático por mora de cobro (HU-61): bloquea a un Propietario cuando
 * tiene cualquier cobro sin pagar cuyo retraso supere `dias_tolerancia_cobro`
 * tras su `fecha_vencimiento`, y lo re-activa al pagar si ya no queda morosidad.
 * El bloqueo/re-activación usa `PropietariosService.setEstatus` (cascada HU-05) y el
 * efecto es inmediato gracias a la revalidación de estatus del JwtAuthGuard.
 */
@Injectable()
export class PropietarioMoraService {
  constructor(
    @InjectRepository(CobroPropietario)
    private readonly cobroRepo: Repository<CobroPropietario>,
    private readonly propietariosService: PropietariosService,
  ) {}

  async bloquearMorosos(hoy: Date = new Date()): Promise<number> {
    const cobros = await this.cobroRepo.find({
      where: { estado: Not("pagado") },
      relations: { propietario: true },
    });

    const propietariosMorosos = new Set<number>();
    for (const cobro of cobros) {
      if (cobro.estado === "pagado") continue;
      const propietario = cobro.propietario;
      if (!propietario || propietario.estatus !== "activo") continue;
      if (this.esMoroso(cobro.fechaVencimiento, propietario.diasToleranciaCobro ?? 0, hoy)) {
        propietariosMorosos.add(propietario.id);
      }
    }

    let bloqueados = 0;
    for (const propietarioId of propietariosMorosos) {
      await this.propietariosService.setEstatus(propietarioId, "bloqueado");
      bloqueados += 1;
    }
    return bloqueados;
  }

  async habilitarSiSinMorosidad(propietarioId: number, hoy: Date = new Date()): Promise<boolean> {
    const propietario = await this.propietariosService.obtener(propietarioId);
    if (propietario.estatus !== "bloqueado") {
      return false;
    }

    const cobros = await this.cobroRepo.find({
      where: { propietario: { id: propietarioId }, estado: Not("pagado") },
    });
    const sigueMoroso = cobros.some((cobro) =>
      this.esMoroso(cobro.fechaVencimiento, propietario.diasToleranciaCobro ?? 0, hoy),
    );
    if (sigueMoroso) {
      return false;
    }

    await this.propietariosService.setEstatus(propietarioId, "activo");
    return true;
  }

  private esMoroso(fechaVencimiento: string, diasTolerancia: number, hoy: Date): boolean {
    const vencimiento = new Date(`${fechaVencimiento}T00:00:00Z`);
    vencimiento.setUTCDate(vencimiento.getUTCDate() + diasTolerancia);
    return formatDate(vencimiento) < formatDate(hoy);
  }
}