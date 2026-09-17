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
import { Cartera } from "./cartera.entity";

@Entity("reportes_diarios")
export class ReporteDiario {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cartera, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "cartera_id" })
  cartera!: Cartera;

  @RelationId((reporte: ReporteDiario) => reporte.cartera)
  carteraId!: number;

  @Column({ type: "date" })
  fecha!: string;

  @Column({ name: "cobrado_dia", type: "numeric", precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  cobradoDia!: number;

  @Column({ name: "prestado_dia", type: "numeric", precision: 12, scale: 2, default: 0, transformer: numericTransformer })
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