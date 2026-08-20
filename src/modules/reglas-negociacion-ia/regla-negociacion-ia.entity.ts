import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { numericTransformer } from "../../common/numeric-transformer";

export interface ReglasNegociacionIaValores {
  maxDiasProrroga: number;
  minAbonoAceptablePct: number;
  maxReprogramacionesPorCliente: number;
  umbralSaldoAutonomo: number;
}

export const REGLAS_NEGOCIACION_IA_DEFAULTS: ReglasNegociacionIaValores = {
  maxDiasProrroga: 0,
  minAbonoAceptablePct: 0,
  maxReprogramacionesPorCliente: 0,
  umbralSaldoAutonomo: 0,
};

/**
 * HU-25: límites financieros y reglas de negociación que el asistente de IA
 * puede ofrecer autónomamente. Fila activa única (upsert) por tenant; en el MVP
 * single-tenant no hay tenant_id (consistente con el resto del esquema).
 * `configurado_por` y `vigente_desde` se auto-llenan al guardar.
 */
@Entity("reglas_negociacion_ia")
export class ReglaNegociacionIa {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "max_dias_prorroga", type: "int" })
  maxDiasProrroga!: number;

  @Column({
    name: "min_abono_aceptable_pct",
    type: "numeric",
    precision: 6,
    scale: 2,
    transformer: numericTransformer,
  })
  minAbonoAceptablePct!: number;

  @Column({ name: "max_reprogramaciones_por_cliente", type: "int" })
  maxReprogramacionesPorCliente!: number;

  @Column({
    name: "umbral_saldo_autonomo",
    type: "numeric",
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  umbralSaldoAutonomo!: number;

  @Column({ name: "configurado_por", type: "int" })
  configuradoPor!: number;

  @Column({ name: "vigente_desde", type: "timestamp" })
  vigenteDesde!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
