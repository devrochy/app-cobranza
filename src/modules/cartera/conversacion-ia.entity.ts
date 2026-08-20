import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Cliente } from "./cliente.entity";

export const CONVERSACION_ESTADO = ["activa", "derivada", "resuelta"] as const;
export type ConversacionEstado = (typeof CONVERSACION_ESTADO)[number];

@Entity("conversaciones_ia")
export class ConversacionIa {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cliente, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "cliente_id" })
  cliente!: Cliente;

  @RelationId((c: ConversacionIa) => c.cliente)
  clienteId!: number;

  @Column({ type: "varchar", default: "whatsapp" })
  canal!: string;

  @Column({ type: "varchar", default: "activa" })
  estado!: ConversacionEstado;

  @Column({ name: "motivo_derivacion", type: "varchar", nullable: true })
  motivoDerivacion!: string | null;

  @Column({ name: "agente_asignado_id", type: "int", nullable: true })
  agenteAsignadoId!: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "closed_at", type: "timestamp", nullable: true })
  closedAt!: Date | null;
}