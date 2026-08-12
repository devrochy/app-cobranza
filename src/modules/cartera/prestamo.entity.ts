import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  ValueTransformer,
} from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";

export const PRESTAMO_ESTATUS = ["vigente", "liquidado", "cancelado"] as const;
export type PrestamoEstatus = (typeof PRESTAMO_ESTATUS)[number];

const numericTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number.parseFloat(value),
};

@Entity("prestamos")
export class Prestamo {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cliente, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cliente_id" })
  cliente!: Cliente;

  @RelationId((prestamo: Prestamo) => prestamo.cliente)
  clienteId!: number;

  @ManyToOne(() => Ruta, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((prestamo: Prestamo) => prestamo.ruta)
  rutaId!: number;

  @Column({ type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valor!: number;

  @Column({ type: "int" })
  numCuotas!: number;

  // Desviación del PRD 4.2 (backlog): el préstamo cierra su propia tasa.
  @Column({ name: "tipo_interes", type: "numeric", precision: 6, scale: 2, transformer: numericTransformer })
  tipoInteres!: number;

  // Desviación del PRD 4.2 (decisión): periodo en días definido al generar el préstamo.
  @Column({ name: "dias_entre_cuotas", type: "int" })
  diasEntreCuotas!: number;

  @Column({ name: "fecha_otorgado", type: "timestamp" })
  fechaOtorgado!: Date;

  @Column({ type: "float" })
  latitud!: number;

  @Column({ type: "float" })
  longitud!: number;

  @Column({ type: "varchar", default: "vigente" })
  estatus!: PrestamoEstatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
