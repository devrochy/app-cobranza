import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { Gestor } from "./gestor.entity";

export const GESTOR_PERMISOS = [
  "registrar_prestamo",
  "registrar_pago",
  "registrar_abono",
  "registrar_gasto",
  "registrar_no_pago",
  "anotar_notas_cartera",
  "actualizar_cliente",
  "eliminar_prestamo",
  "eliminar_pago",
  "eliminar_abono",
  "eliminar_gasto",
  "registrar_inyeccion",
  "ver_cartera",
  "generar_reporte",
  "actualizar_cartera",
] as const;

export type GestorPermisoNombre = (typeof GESTOR_PERMISOS)[number];

@Unique("UQ_gestor_permiso", ["gestor", "permiso"])
@Entity("gestor_permisos")
export class GestorPermiso {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Gestor, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "gestor_id" })
  gestor!: Gestor;

  @RelationId((permiso: GestorPermiso) => permiso.gestor)
  gestorId!: number;

  @Column({ type: "varchar", length: 40 })
  permiso!: GestorPermisoNombre;

  @Column()
  habilitado!: boolean;
}
