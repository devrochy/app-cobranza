import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { ConversacionSocio } from "./conversacion-socio.entity";

export const MENSAJE_SOCIO_EMISOR = ["admin", "socio", "sistema"] as const;
export type MensajeSocioEmisor = (typeof MENSAJE_SOCIO_EMISOR)[number];

export const MENSAJE_SOCIO_TIPO = ["notificacion_cobro", "manual"] as const;
export type MensajeSocioTipo = (typeof MENSAJE_SOCIO_TIPO)[number];

export const MENSAJE_SOCIO_SUBTIPO = [
  "recordatorio",
  "aviso_dia",
  "confirmacion_pago",
  "alerta_vencido",
] as const;
export type MensajeSocioSubtipo = (typeof MENSAJE_SOCIO_SUBTIPO)[number];

@Entity("mensajes_socio")
export class MensajeSocio {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ConversacionSocio, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "conversacion_id" })
  conversacion!: ConversacionSocio;

  @RelationId((mensaje: MensajeSocio) => mensaje.conversacion)
  conversacionId!: number;

  @Column({ type: "varchar" })
  emisor!: MensajeSocioEmisor;

  @Column({ type: "text" })
  contenido!: string;

  @Column({ type: "varchar" })
  tipo!: MensajeSocioTipo;

  @Column({ type: "varchar", nullable: true })
  subtipo!: string | null;

  @CreateDateColumn({ name: "timestamp" })
  timestamp!: Date;
}