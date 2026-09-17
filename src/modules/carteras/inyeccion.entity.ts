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

export const INYECCION_ESTADO = ["activa", "eliminada"] as const;
export type InyeccionEstado = (typeof INYECCION_ESTADO)[number];

@Entity("inyecciones")
export class Inyeccion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cartera, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cartera_id" })
  cartera!: Cartera;

  @RelationId((inyeccion: Inyeccion) => inyeccion.cartera)
  carteraId!: number;

  @Column({ type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valor!: number;

  @Column()
  comentario!: string;

  @CreateDateColumn({ name: "fecha_hora" })
  fechaHora!: Date;

  @Column({ type: "varchar", default: "activa" })
  estado!: InyeccionEstado;
}
