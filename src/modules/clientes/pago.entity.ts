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
import { Cuota } from "./cuota.entity";

@Entity("pagos")
export class Pago {
  @PrimaryGeneratedColumn()
  id!: number;

  // HU-48: nullable para conservar trazabilidad del pago si se elimina su cuota.
  @ManyToOne(() => Cuota, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "cuota_id" })
  cuota!: Cuota | null;

  @RelationId((pago: Pago) => pago.cuota)
  cuotaId!: number | null;

  @ManyToOne(() => Cliente, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cliente_id" })
  cliente!: Cliente;

  @RelationId((pago: Pago) => pago.cliente)
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

  // La APK solo permite borrar pagos que NO estén liquidados (fin del día).
  @Column({ type: "boolean", default: false })
  liquidado!: boolean;

  @Column({ name: "fecha_liquidacion", type: "timestamp", nullable: true })
  fechaLiquidacion!: Date | null;
}
