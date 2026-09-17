import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Propietario } from "../propietarios/propietario.entity";

export const CONVERSACION_PROPIETARIO_ESTADO = ["activa", "cerrada"] as const;
export type ConversacionPropietarioEstado = (typeof CONVERSACION_PROPIETARIO_ESTADO)[number];

@Entity("conversaciones_propietario")
export class ConversacionPropietario {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Propietario, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "propietario_id" })
  propietario!: Propietario;

  @RelationId((conversacion: ConversacionPropietario) => conversacion.propietario)
  propietarioId!: number;

  @Column({ type: "varchar", default: "whatsapp" })
  canal!: string;

  @Column({ type: "varchar", default: "activa" })
  estado!: ConversacionPropietarioEstado;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}