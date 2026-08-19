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

export const INYECCION_ESTADO = ["activa", "eliminada"] as const;
export type InyeccionEstado = (typeof INYECCION_ESTADO)[number];

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
