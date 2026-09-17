import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { numericTransformer } from "../../common/numeric-transformer";
import { MetodoPago } from "../../domain/metodo-pago";
import { Propietario } from "../propietarios/propietario.entity";
import { LinkPago } from "./link-pago.entity";

export const COBRO_PROPIETARIO_ESTADO = ["pendiente", "pagado", "vencido"] as const;
export type CobroPropietarioEstado = (typeof COBRO_PROPIETARIO_ESTADO)[number];

@Unique("UQ_cobro_propietario_periodo", ["propietario", "periodo"])
@Entity("cobros_propietario")
export class CobroPropietario {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Propietario, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "propietario_id" })
  propietario!: Propietario;

  @RelationId((cobro: CobroPropietario) => cobro.propietario)
  propietarioId!: number;

  @Column()
  periodo!: string;

  @Column({ name: "monto_calculado", type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  montoCalculado!: number;

  @Column({ name: "monto_pagado", type: "numeric", precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  montoPagado!: number | null;

  @Column({ name: "fecha_vencimiento", type: "date" })
  fechaVencimiento!: string;

  @Column({ name: "fecha_pago", type: "date", nullable: true })
  fechaPago!: string | null;

  @Column({ type: "varchar", default: "pendiente" })
  estado!: CobroPropietarioEstado;

  @Column({ name: "metodo_pago", type: "varchar", nullable: true })
  metodoPago!: MetodoPago | null;

  @Column({ name: "registrado_por", type: "int", nullable: true })
  registradoPor!: number | null;

  @OneToOne(() => LinkPago, (link) => link.cobroPropietario)
  linkPago?: LinkPago;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}