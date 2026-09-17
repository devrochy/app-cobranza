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
import { Ruta } from "./ruta.entity";

/**
 * Snapshot diario de las estadísticas operativas de una ruta (HU de monitoreo).
 * Se persiste al cierre del día para poder comparar el día actual contra el
 * día anterior sin recalcular históricos.
 */
@Entity("ruta_estadisticas_snapshot")
@Unique("uq_ruta_estadisticas_snapshot_ruta_fecha", ["ruta", "fecha"])
export class RutaEstadisticasSnapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((snapshot: RutaEstadisticasSnapshot) => snapshot.ruta)
  rutaId!: number;

  @Column({ type: "date" })
  fecha!: string;

  @Column({ name: "total_clientes", type: "int", default: 0 })
  totalClientes!: number;

  @Column({ name: "clientes_atrasados", type: "int", default: 0 })
  clientesAtrasados!: number;

  @Column({ name: "clientes_vencidos", type: "int", default: 0 })
  clientesVencidos!: number;

  @Column({ name: "sin_visita_hoy", type: "int", default: 0 })
  sinVisitaHoy!: number;

  @Column({ name: "sin_visita_desde_ultima_liquidada", type: "int", default: 0 })
  sinVisitaDesdeUltimaLiquidada!: number;

  @Column({ name: "con_prestamos_nuevos", type: "int", default: 0 })
  conPrestamosNuevos!: number;

  @Column({ name: "con_mas_de_un_prestamo", type: "int", default: 0 })
  conMasDeUnPrestamo!: number;

  @Column({ name: "clientes_nuevos", type: "int", default: 0 })
  clientesNuevos!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
