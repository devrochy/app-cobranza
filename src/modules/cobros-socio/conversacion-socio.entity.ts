import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Socio } from "../socios/socio.entity";

export const CONVERSACION_SOCIO_ESTADO = ["activa", "cerrada"] as const;
export type ConversacionSocioEstado = (typeof CONVERSACION_SOCIO_ESTADO)[number];

@Entity("conversaciones_socio")
export class ConversacionSocio {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Socio, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "socio_id" })
  socio!: Socio;

  @RelationId((conversacion: ConversacionSocio) => conversacion.socio)
  socioId!: number;

  @Column({ type: "varchar", default: "whatsapp" })
  canal!: string;

  @Column({ type: "varchar", default: "activa" })
  estado!: ConversacionSocioEstado;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}