import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { Propietario } from "./propietario.entity";

export const PROPIETARIO_PERMISOS = [
  "borrar_clientes",
  "eliminar_carteras",
  "actualizar_cliente",
  "anotar_notas_cartera",
  "eliminar_prestamos",
  "borrar_ultima_cuota",
  "eliminar_pago",
  "configurar_cartera",
  "eliminar_abono",
  "eliminar_inyeccion",
  "generar_reporte",
  "ver_reportes",
  "descargar_reporte",
  "bloquear_gestores",
  "eliminar_gastos",
  "registrar_gasto",
  "registrar_propietario",
  "bloquear_propietario",
  "editar_permisos",
  "modificar_cupo",
  "eliminar_propietario",
  "registrar_gestor",
  "registrar_cartera",
  "editar_configuracion_propietario",
] as const;

export type PropietarioPermisoNombre = (typeof PROPIETARIO_PERMISOS)[number];

@Unique("UQ_propietario_permiso", ["propietario", "permiso"])
@Entity("propietario_permisos")
export class PropietarioPermiso {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Propietario, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "propietario_id" })
  propietario!: Propietario;

  @RelationId((permiso: PropietarioPermiso) => permiso.propietario)
  propietarioId!: number;

  @Column({ type: "varchar", length: 40 })
  permiso!: PropietarioPermisoNombre;

  @Column()
  habilitado!: boolean;
}
