import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { ConversacionIa } from "./conversacion-ia.entity";

export const MENSAJE_EMISOR = ["cliente", "ia", "agente"] as const;
export type MensajeEmisor = (typeof MENSAJE_EMISOR)[number];

@Entity("mensajes_ia")
export class MensajeIa {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ConversacionIa, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "conversacion_id" })
  conversacion!: ConversacionIa;

  @RelationId((m: MensajeIa) => m.conversacion)
  conversacionId!: number;

  @Column({ type: "varchar" })
  emisor!: MensajeEmisor;

  @Column({ type: "text" })
  contenido!: string;

  @Column({ name: "intencion_detectada", type: "varchar", nullable: true })
  intencionDetectada!: string | null;

  @Column({ name: "modelo_usado", type: "varchar", nullable: true })
  modeloUsado!: string | null;

  @CreateDateColumn({ name: "timestamp" })
  timestamp!: Date;
}