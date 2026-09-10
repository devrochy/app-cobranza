import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AlertasService } from "./alertas.service";
import { IntentoAcceso, IntentoMotivo } from "./intento-acceso.entity";

export interface RegistrarIntentoInput {
  cobradorId: number | null;
  imei: string | null;
  whatsappNumber: string | null;
  motivo: IntentoMotivo;
}

/**
 * Registro y consulta de intentos de acceso no autorizados (HU-42). Cada
 * registro dispara la alerta correspondiente (mock en el MVP).
 */
@Injectable()
export class IntentosAccesoService {
  constructor(
    @InjectRepository(IntentoAcceso)
    private readonly repo: Repository<IntentoAcceso>,
    private readonly alertas: AlertasService,
  ) {}

  async registrar(input: RegistrarIntentoInput): Promise<IntentoAcceso> {
    const intento = this.repo.create(input);
    const saved = await this.repo.save(intento);
    await this.alertas.notificarIntentoNoAutorizado({
      cobradorId: input.cobradorId,
      imei: input.imei,
      whatsappNumber: input.whatsappNumber,
      motivo: input.motivo,
    });
    return saved;
  }

  async listar(): Promise<IntentoAcceso[]> {
    return this.repo.find({ order: { id: "DESC" } });
  }
}
