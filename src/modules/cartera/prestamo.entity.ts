import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { numericTransformer } from "../../common/numeric-transformer";

export const PRESTAMO_ESTATUS = ["vigente", "liquidado", "cancelado"] as const;
export type PrestamoEstatus = (typeof PRESTAMO_ESTATUS)[number];

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

  @Column({ name: "fiador_nombre", type: "varchar", nullable: true })
  fiadorNombre!: string | null;

  @Column({ name: "fiador_apellido", type: "varchar", nullable: true })
  fiadorApellido!: string | null;

  @Column({ name: "fiador_documento", type: "varchar", nullable: true })
  fiadorDocumento!: string | null;

  @Column({ name: "fiador_telefono", type: "varchar", nullable: true })
  fiadorTelefono!: string | null;

  @Column({ type: "varchar", default: "vigente" })
  estatus!: PrestamoEstatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @OneToMany(() => Cuota, (cuota) => cuota.prestamo)
  cuotas?: Cuota[];
}
