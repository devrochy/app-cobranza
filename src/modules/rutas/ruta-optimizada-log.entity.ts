import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Ruta } from "./ruta.entity";

export const TIPO_TRAYECTO = ["planificada", "real"] as const;
export type TipoTrayecto = (typeof TIPO_TRAYECTO)[number];

@Entity("ruta_optimizada_log")
export class RutaOptimizadaLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((log: RutaOptimizadaLog) => log.ruta)
  rutaId!: number;

  @Column({ name: "reporte_diario_id", type: "int", nullable: true })
  reporteDiarioId!: number | null;

  @Column({ type: "date" })
  fecha!: string;

  @Column({ name: "orden_clientes_json", type: "jsonb" })
  ordenClientesJson!: unknown;

  @Column({ name: "waypoints_geojson", type: "jsonb" })
  waypointsGeojson!: unknown;

  @Column({ name: "distancia_estimada_km", type: "numeric", precision: 10, scale: 2, default: 0 })
  distanciaEstimadaKm!: number;

  @Column({ name: "tiempo_estimado_min", type: "int", default: 0 })
  tiempoEstimadoMin!: number;

  @Column({ default: false })
  recalculado!: boolean;

  @Column({ name: "motivo_recalculo", type: "varchar", nullable: true })
  motivoRecalculo!: string | null;

  @Column({ type: "varchar" })
  tipo!: TipoTrayecto;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}