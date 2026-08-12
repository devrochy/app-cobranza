import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  ValueTransformer,
} from "typeorm";
import { Ruta } from "./ruta.entity";

export const INYECCION_ESTADO = ["activa", "eliminada"] as const;
export type InyeccionEstado = (typeof INYECCION_ESTADO)[number];

const numericTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number.parseFloat(value),
};

@Entity("inyecciones")
export class Inyeccion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((inyeccion: Inyeccion) => inyeccion.ruta)
  rutaId!: number;

  @Column({ type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valor!: number;

  @Column()
  comentario!: string;

  @CreateDateColumn({ name: "fecha_hora" })
  fechaHora!: Date;

  @Column({ type: "varchar", default: "activa" })
  estado!: InyeccionEstado;
}
