import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  ValueTransformer,
} from "typeorm";
import { Prestamo } from "./prestamo.entity";

export const CUOTA_ESTATUS = ["pendiente", "pagada", "atrasada"] as const;
export type CuotaEstatus = (typeof CUOTA_ESTATUS)[number];

const numericTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number.parseFloat(value),
};

@Entity("cuotas")
export class Cuota {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Prestamo, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "prestamo_id" })
  prestamo!: Prestamo;

  @RelationId((cuota: Cuota) => cuota.prestamo)
  prestamoId!: number;

  @Column({ name: "numero_cuota", type: "int" })
  numeroCuota!: number;

  @Column({ name: "valor_esperado", type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valorEsperado!: number;

  @Column({ name: "fecha_vencimiento", type: "date" })
  fechaVencimiento!: string;

  @Column({ type: "varchar", default: "pendiente" })
  estatus!: CuotaEstatus;
}
