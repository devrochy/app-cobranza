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
import { MotivoNoPago } from "../../domain/motivos-no-pago";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { Prestamo } from "./prestamo.entity";

export const VISITA_RESULTADO = ["pago", "no_pago"] as const;
export type VisitaResultado = (typeof VISITA_RESULTADO)[number];

@Entity("visitas")
export class Visita {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((visita: Visita) => visita.ruta)
  rutaId!: number;

  @ManyToOne(() => Cliente, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cliente_id" })
  cliente!: Cliente;

  @RelationId((visita: Visita) => visita.cliente)
  clienteId!: number;

  @ManyToOne(() => Prestamo, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "prestamo_principal_id" })
  prestamoPrincipal!: Prestamo;

  @RelationId((visita: Visita) => visita.prestamoPrincipal)
  prestamoPrincipalId!: number;

  @Column({ type: "date" })
  fecha!: string;

  @Column({ type: "varchar" })
  resultado!: VisitaResultado;

  @Column({ name: "motivo_no_pago", type: "varchar", nullable: true })
  motivoNoPago!: MotivoNoPago | null;

  @Column({ name: "valor_pagado", type: "numeric", precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  valorPagado!: number | null;

  @Column({ name: "metodo_pago", type: "varchar", nullable: true })
  metodoPago!: MetodoPago | null;

  @Column({ name: "creado_por_rol", type: "varchar" })
  creadoPorRol!: string;

  @Column({ name: "creado_por_id", type: "int" })
  creadoPorId!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
