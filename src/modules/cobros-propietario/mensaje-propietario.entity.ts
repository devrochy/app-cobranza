import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { ConversacionPropietario } from "./conversacion-propietario.entity";

export const MENSAJE_PROPIETARIO_EMISOR = ["admin", "propietario", "sistema"] as const;
export type MensajePropietarioEmisor = (typeof MENSAJE_PROPIETARIO_EMISOR)[number];

export const MENSAJE_PROPIETARIO_TIPO = ["notificacion_cobro", "manual"] as const;
export type MensajePropietarioTipo = (typeof MENSAJE_PROPIETARIO_TIPO)[number];

export const MENSAJE_PROPIETARIO_SUBTIPO = [
  "recordatorio",
  "aviso_dia",
  "confirmacion_pago",
  "alerta_vencido",
] as const;
export type MensajePropietarioSubtipo = (typeof MENSAJE_PROPIETARIO_SUBTIPO)[number];

@Entity("mensajes_propietario")
export class MensajePropietario {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ConversacionPropietario, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "conversacion_id" })
  conversacion!: ConversacionPropietario;

  @RelationId((mensaje: MensajePropietario) => mensaje.conversacion)
  conversacionId!: number;

  @Column({ type: "varchar" })
  emisor!: MensajePropietarioEmisor;

  @Column({ type: "text" })
  contenido!: string;

  @Column({ type: "varchar" })
  tipo!: MensajePropietarioTipo;

  @Column({ type: "varchar", nullable: true })
  subtipo!: string | null;

  @CreateDateColumn({ name: "timestamp" })
  timestamp!: Date;
}