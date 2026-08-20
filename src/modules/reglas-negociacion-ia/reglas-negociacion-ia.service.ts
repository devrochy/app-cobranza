import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ReglaNegociacionIa,
  ReglasNegociacionIaValores,
  REGLAS_NEGOCIACION_IA_DEFAULTS,
} from "./regla-negociacion-ia.entity";

export interface ReglasNegociacionIaPublic extends ReglasNegociacionIaValores {
  configuradoPor: number | null;
  vigenteDesde: Date | null;
}

/**
 * HU-25: configuración de los límites financieros y reglas de negociación del
 * asistente de IA. Opera sobre una fila activa única (upsert). En el MVP solo
 * se persiste y expone; el motor que evalúa estas reglas (HU-31) es posterior.
 */
@Injectable()
export class ReglasNegociacionIaService {
  constructor(
    @InjectRepository(ReglaNegociacionIa)
    private readonly repo: Repository<ReglaNegociacionIa>,
  ) {}

  async obtener(): Promise<ReglasNegociacionIaPublic> {
    const fila = await this.primera();

    if (!fila) {
      return {
        ...REGLAS_NEGOCIACION_IA_DEFAULTS,
        configuradoPor: null,
        vigenteDesde: null,
      };
    }

    return this.toPublic(fila);
  }

  async guardar(
    valores: ReglasNegociacionIaValores,
    adminId: number,
  ): Promise<ReglasNegociacionIaPublic> {
    const existente = await this.primera();

    if (existente) {
      existente.maxDiasProrroga = valores.maxDiasProrroga;
      existente.minAbonoAceptablePct = valores.minAbonoAceptablePct;
      existente.maxReprogramacionesPorCliente = valores.maxReprogramacionesPorCliente;
      existente.umbralSaldoAutonomo = valores.umbralSaldoAutonomo;
      existente.configuradoPor = adminId;
      existente.vigenteDesde = new Date();
      const guardado = await this.repo.save(existente);
      return this.toPublic(guardado);
    }

    const nueva = this.repo.create({
      ...valores,
      configuradoPor: adminId,
      vigenteDesde: new Date(),
    });
    const guardada = await this.repo.save(nueva);
    return this.toPublic(guardada);
  }

  private async primera(): Promise<ReglaNegociacionIa | null> {
    const filas = await this.repo.find({ order: { id: "ASC" }, take: 1 });
    return filas[0] ?? null;
  }

  private toPublic(fila: ReglaNegociacionIa): ReglasNegociacionIaPublic {
    return {
      maxDiasProrroga: fila.maxDiasProrroga,
      minAbonoAceptablePct: fila.minAbonoAceptablePct,
      maxReprogramacionesPorCliente: fila.maxReprogramacionesPorCliente,
      umbralSaldoAutonomo: fila.umbralSaldoAutonomo,
      configuradoPor: fila.configuradoPor,
      vigenteDesde: fila.vigenteDesde,
    };
  }
}
