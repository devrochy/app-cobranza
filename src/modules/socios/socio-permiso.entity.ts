import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { Socio } from "./socio.entity";

export const SOCIO_PERMISOS = [
  "borrar_clientes",
  "eliminar_rutas",
  "actualizar_cliente",
  "eliminar_prestamos",
  "borrar_ultima_cuota",
  "configurar_ruta",
  "eliminar_abono",
  "eliminar_inyeccion",
  "generar_reporte",
  "ver_reportes",
  "descargar_reporte",
  "bloquear_cobradores",
  "eliminar_gastos",
  "registrar_gasto",
  "registrar_socio",
  "bloquear_socio",
  "editar_permisos",
  "modificar_cupo",
  "eliminar_socio",
  "registrar_cobrador",
  "registrar_ruta",
] as const;

export type SocioPermisoNombre = (typeof SOCIO_PERMISOS)[number];

@Unique("UQ_socio_permiso", ["socio", "permiso"])
@Entity("socio_permisos")
export class SocioPermiso {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Socio, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "socio_id" })
  socio!: Socio;

  @RelationId((permiso: SocioPermiso) => permiso.socio)
  socioId!: number;

  @Column({ type: "varchar", length: 40 })
  permiso!: SocioPermisoNombre;

  @Column()
  habilitado!: boolean;
}
