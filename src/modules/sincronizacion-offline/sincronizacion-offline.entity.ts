import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { Device } from "./device.entity";

export const SYNC_EVENTO_ESTADO = [
  "pendiente",
  "procesando",
  "sincronizado",
  "error",
] as const;
export type SyncEventoEstado = (typeof SYNC_EVENTO_ESTADO)[number];

/**
 * Evento generado por el dispositivo sin conexión (HU-64). Se registra con un
 * `evento_id_cliente` (uuid generado en el dispositivo) y se deduplica por
 * `(dispositivo, evento_id_cliente)` para idempotencia ante reintentos.
 * Nota: el PRD modela `dispositivo_id` nullable; aquí se exige (FK) para que la
 * unicidad de dedup sea fiable.
 */
@Unique("UQ_sync_dispositivo_evento", ["dispositivo", "eventoIdCliente"])
@Entity("sincronizacion_offline")
export class SincronizacionOffline {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Device, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "dispositivo_id" })
  dispositivo!: Device;

  @RelationId((evento: SincronizacionOffline) => evento.dispositivo)
  dispositivoId!: number;

  @Column({ name: "evento_id_cliente", type: "uuid" })
  eventoIdCliente!: string;

  @Column({ name: "tipo_evento", type: "varchar" })
  tipoEvento!: string;

  @Column({ name: "payload_json", type: "jsonb" })
  payloadJson!: unknown;

  @Column({ type: "varchar", default: "pendiente" })
  estado!: SyncEventoEstado;

  @Column({ name: "error_motivo", type: "varchar", nullable: true })
  errorMotivo!: string | null;

  @Column({ type: "int", default: 0 })
  reintentos!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "synced_at", type: "timestamp", nullable: true })
  syncedAt!: Date | null;
}