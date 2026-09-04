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
import { MetodoPago } from "../../domain/metodo-pago";
import { Cliente } from "./cliente.entity";
import { Prestamo } from "./prestamo.entity";

@Entity("abonos")
export class Abono {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Prestamo, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "prestamo_id" })
  prestamo!: Prestamo;

  @RelationId((abono: Abono) => abono.prestamo)
  prestamoId!: number;

  @ManyToOne(() => Cliente, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cliente_id" })
  cliente!: Cliente;

  @RelationId((abono: Abono) => abono.cliente)
  clienteId!: number;

  @Column({ name: "visita_id", type: "int", nullable: true })
  visitaId!: number | null;

  @Column({ type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valor!: number;

  @Column({ name: "metodo_pago", type: "varchar" })
  metodoPago!: MetodoPago;

  @CreateDateColumn({ name: "fecha_hora" })
  fechaHora!: Date;

  @Column({ name: "registrado_por", type: "int", nullable: true })
  registradoPor!: number | null;

  // La APK solo permite borrar abonos que NO estén liquidados (fin del día).
  @Column({ type: "boolean", default: false })
  liquidado!: boolean;

  @Column({ name: "fecha_liquidacion", type: "timestamp", nullable: true })
  fechaLiquidacion!: Date | null;
}
