import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { numericTransformer } from "../../common/numeric-transformer";
import { Cartera } from "./cartera.entity";

export const GASTO_ESTADO = ["activo", "eliminado"] as const;
export type GastoEstado = (typeof GASTO_ESTADO)[number];

@Entity("gastos")
export class Gasto {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cartera, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cartera_id" })
  cartera!: Cartera;

  @RelationId((gasto: Gasto) => gasto.cartera)
  carteraId!: number;

  @Column()
  descripcion!: string;

  @Column({ type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valor!: number;

  @Column({ name: "creado_por", type: "int", nullable: true })
  creadoPor!: number | null;

  @Column()
  aprobado!: boolean;

  @Column({ name: "aprobado_por", type: "int", nullable: true })
  aprobadoPor!: number | null;

  @Column({ type: "varchar", default: "activo" })
  estado!: GastoEstado;

  @CreateDateColumn({ name: "fecha_hora" })
  fechaHora!: Date;
}
