import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { numericTransformer } from "../../common/numeric-transformer";
import { PeriodoLiquidacion } from "../../domain/liquidacion";
import { Ruta } from "./ruta.entity";

@Unique("UQ_liquidacion_ruta_periodo_fecha", ["ruta", "periodo", "fecha"])
@Entity("liquidaciones")
export class Liquidacion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((liquidacion: Liquidacion) => liquidacion.ruta)
  rutaId!: number;

  @Column({ type: "date" })
  fecha!: string;

  @Column({ type: "varchar" })
  periodo!: PeriodoLiquidacion;

  @Column({ name: "caja_anterior", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  cajaAnterior!: number;

  @Column({ name: "caja_actual", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  cajaActual!: number;

  @Column({ name: "estimado_a_cobrar", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  estimadoACobrar!: number;

  @Column({ name: "total_inyeccion", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  totalInyeccion!: number;

  @Column({ name: "total_cobrado_periodo", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  totalCobradoPeriodo!: number;

  @Column({ name: "total_cobrado_dia", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  totalCobradoDia!: number;

  @Column({ name: "total_prestado", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  totalPrestado!: number;

  @Column({ name: "total_gastos", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  totalGastos!: number;

  @Column({ name: "suma_cartera", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  sumaCartera!: number;

  @Column({ name: "comision_porcentaje", type: "numeric", precision: 5, scale: 2, transformer: numericTransformer })
  comisionPorcentaje!: number;

  @Column({ name: "comision_valor", type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
  comisionValor!: number;

  @Column({ type: "varchar", nullable: true })
  comentario!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}