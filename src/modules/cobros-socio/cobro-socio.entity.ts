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
import { Socio } from "../socios/socio.entity";
import { LinkPago } from "./link-pago.entity";

export const COBRO_SOCIO_ESTADO = ["pendiente", "pagado", "vencido"] as const;
export type CobroSocioEstado = (typeof COBRO_SOCIO_ESTADO)[number];

@Unique("UQ_cobro_socio_periodo", ["socio", "periodo"])
@Entity("cobros_socio")
export class CobroSocio {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Socio, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "socio_id" })
  socio!: Socio;

  @RelationId((cobro: CobroSocio) => cobro.socio)
  socioId!: number;

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
  estado!: CobroSocioEstado;

  @Column({ name: "metodo_pago", type: "varchar", nullable: true })
  metodoPago!: MetodoPago | null;

  @Column({ name: "registrado_por", type: "int", nullable: true })
  registradoPor!: number | null;

  @OneToOne(() => LinkPago, (link) => link.cobroSocio)
  linkPago?: LinkPago;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}