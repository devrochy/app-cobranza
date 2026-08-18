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
import { Ruta } from "./ruta.entity";

export const GASTO_ESTADO = ["activo", "eliminado"] as const;
export type GastoEstado = (typeof GASTO_ESTADO)[number];

@Entity("gastos")
export class Gasto {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((gasto: Gasto) => gasto.ruta)
  rutaId!: number;

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
