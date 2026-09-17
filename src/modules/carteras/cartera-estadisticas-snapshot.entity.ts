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
import { Cartera } from "./cartera.entity";

/**
 * Snapshot diario de las estadísticas operativas de una cartera (HU de monitoreo).
 * Se persiste al cierre del día para poder comparar el día actual contra el
 * día anterior sin recalcular históricos.
 */
@Entity("cartera_estadisticas_snapshot")
@Unique("uq_cartera_estadisticas_snapshot_cartera_fecha", ["cartera", "fecha"])
export class CarteraEstadisticasSnapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cartera, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "cartera_id" })
  cartera!: Cartera;

  @RelationId((snapshot: CarteraEstadisticasSnapshot) => snapshot.cartera)
  carteraId!: number;

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
