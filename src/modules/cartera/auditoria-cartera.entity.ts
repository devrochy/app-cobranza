import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

export const AUDITORIA_CARTERA_ENTIDAD = ["cuota", "abono", "pago"] as const;
export type AuditoriaCarteraEntidad = (typeof AUDITORIA_CARTERA_ENTIDAD)[number];

export const AUDITORIA_CARTERA_OPERACION = ["editar", "eliminar"] as const;
export type AuditoriaCarteraOperacion = (typeof AUDITORIA_CARTERA_OPERACION)[number];

@Entity("auditoria_cartera")
export class AuditoriaCartera {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  entidad!: AuditoriaCarteraEntidad;

  @Column({ name: "entidad_id", type: "int" })
  entidadId!: number;

  @Column({ type: "varchar" })
  operacion!: AuditoriaCarteraOperacion;

  @Column({ name: "valores_antes_json", type: "jsonb" })
  valoresAntes!: Record<string, unknown>;

  @Column({ name: "valores_despues_json", type: "jsonb" })
  valoresDespues!: Record<string, unknown>;

  @Column({ name: "actor_rol", type: "varchar" })
  actorRol!: string;

  @Column({ name: "actor_id", type: "int" })
  actorId!: number;

  @Column({ type: "varchar" })
  motivo!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
