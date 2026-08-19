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

export const CAMBIO_CLIENTE_ESTADO = ["pendiente", "aprobado", "rechazado"] as const;
export type CambioClienteEstado = (typeof CAMBIO_CLIENTE_ESTADO)[number];

@Entity("cambios_cliente_pendientes")
export class CambioClientePendiente {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cliente, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cliente_id" })
  cliente!: Cliente;

  @RelationId((cambio: CambioClientePendiente) => cambio.cliente)
  clienteId!: number;

  @Column({ name: "campos_propuestos_json", type: "jsonb" })
  camposPropuestos!: Record<string, unknown>;

  @Column({ type: "varchar", default: "pendiente" })
  estado!: CambioClienteEstado;

  @Column({ name: "solicitado_por_rol", type: "varchar" })
  solicitadoPorRol!: string;

  @Column({ name: "solicitado_por_id", type: "int" })
  solicitadoPorId!: number;

  @Column({ name: "revisado_por", type: "int", nullable: true })
  revisadoPor!: number | null;

  @Column({ name: "revisado_en", type: "timestamp", nullable: true })
  revisadoEn!: Date | null;

  @Column({ name: "motivo_rechazo", type: "varchar", nullable: true })
  motivoRechazo!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
