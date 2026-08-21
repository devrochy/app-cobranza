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
import { Prestamo } from "./prestamo.entity";
import { Visita } from "./visita.entity";
import { ConversacionIa } from "./conversacion-ia.entity";

export const PROMESA_ESTADO = ["pendiente", "cumplida", "incumplida"] as const;
export type PromesaEstado = (typeof PROMESA_ESTADO)[number];

export const PROMESA_CREADOR = ["ia", "cobrador", "agente"] as const;
export type PromesaCreador = (typeof PROMESA_CREADOR)[number];

@Entity("promesas_pago")
export class PromesaPago {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Visita, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "visita_id" })
  visita!: Visita | null;

  @RelationId((promesa: PromesaPago) => promesa.visita)
  visitaId!: number | null;

  // PRD 4.2:338: vínculo opcional con la conversación de IA (promesas del asistente).
  @ManyToOne(() => ConversacionIa, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "conversacion_id" })
  conversacion!: ConversacionIa | null;

  @RelationId((promesa: PromesaPago) => promesa.conversacion)
  conversacionId!: number | null;

  @ManyToOne(() => Prestamo, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "prestamo_id" })
  prestamo!: Prestamo;

  @RelationId((promesa: PromesaPago) => promesa.prestamo)
  prestamoId!: number;

  @Column({ name: "fecha_prometida", type: "date" })
  fechaPrometida!: string;

  @Column({ name: "valor_prometido", type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valorPrometido!: number;

  @Column({ type: "varchar", default: "pendiente" })
  estado!: PromesaEstado;

  @Column({ name: "creado_por", type: "varchar" })
  creadoPor!: PromesaCreador;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
