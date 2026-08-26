import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { CobroSocio } from "./cobro-socio.entity";

export const LINK_PAGO_ESTADO = ["generado", "pagado", "vencido"] as const;
export type LinkPagoEstado = (typeof LINK_PAGO_ESTADO)[number];

@Entity("links_pago")
export class LinkPago {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => CobroSocio, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cobro_socio_id" })
  cobroSocio!: CobroSocio;

  @RelationId((link: LinkPago) => link.cobroSocio)
  cobroSocioId!: number;

  @Column({ type: "varchar" })
  url!: string;

  @Column({ type: "varchar", default: "generado" })
  estado!: LinkPagoEstado;

  @Column({ type: "varchar", default: "mock" })
  proveedor!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}