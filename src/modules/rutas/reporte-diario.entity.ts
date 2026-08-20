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

@Entity("reportes_diarios")
export class ReporteDiario {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((reporte: ReporteDiario) => reporte.ruta)
  rutaId!: number;

  @Column({ type: "date" })
  fecha!: string;

  @Column({ name: "cobrado_dia", type: "numeric", precision: 12, scale: 2, default: 0 })
  cobradoDia!: number;

  @Column({ name: "prestado_dia", type: "numeric", precision: 12, scale: 2, default: 0 })
  prestadoDia!: number;

  @Column({ name: "clientes_visitados_json", type: "jsonb", nullable: true })
  clientesVisitadosJson!: unknown;

  @Column({ name: "clientes_sin_pago_json", type: "jsonb", nullable: true })
  clientesSinPagoJson!: unknown;

  @Column({ name: "trayectorias_json", type: "jsonb", nullable: true })
  trayectoriasJson!: unknown;

  @Column({ name: "hora_inicio", type: "varchar", nullable: true })
  horaInicio!: string | null;

  @Column({ name: "hora_fin", type: "varchar", nullable: true })
  horaFin!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}