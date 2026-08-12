import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { Cobrador } from "./cobrador.entity";

export const COBRADOR_PERMISOS = [
  "registrar_prestamo",
  "registrar_pago",
  "registrar_abono",
  "registrar_gasto",
  "registrar_no_pago",
  "eliminar_prestamo",
  "eliminar_pago",
  "eliminar_abono",
  "eliminar_gasto",
  "registrar_inyeccion",
  "ver_cartera",
  "generar_reporte",
] as const;

export type CobradorPermisoNombre = (typeof COBRADOR_PERMISOS)[number];

@Unique("UQ_cobrador_permiso", ["cobrador", "permiso"])
@Entity("cobrador_permisos")
export class CobradorPermiso {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cobrador, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "cobrador_id" })
  cobrador!: Cobrador;

  @RelationId((permiso: CobradorPermiso) => permiso.cobrador)
  cobradorId!: number;

  @Column({ type: "varchar", length: 40 })
  permiso!: CobradorPermisoNombre;

  @Column()
  habilitado!: boolean;
}
