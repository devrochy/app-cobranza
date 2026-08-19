import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { ColorRiesgo } from "../../domain/color-riesgo";
import { GeoPoint } from "../../common/geo";
import { numericTransformer } from "../../common/numeric-transformer";

export const CLIENTE_ESTATUS = ["activo", "bloqueado"] as const;
export type ClienteEstatus = (typeof CLIENTE_ESTATUS)[number];

@Entity("clientes")
@Index("clientes_ubicacion_gist", ["ubicacion"], { spatial: true })
export class Cliente {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((cliente: Cliente) => cliente.ruta)
  rutaId!: number;

  @Column()
  nombre!: string;

  @Column()
  apellido!: string;

  @Column({ type: "varchar", nullable: true })
  negocio!: string | null;

  @Column({ name: "telefono_whatsapp" })
  telefonoWhatsapp!: string;

  @Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
  ubicacion!: GeoPoint;

  @Column({ name: "ubicacion_domicilio", type: "geography", spatialFeatureType: "Point", srid: 4326, nullable: true })
  ubicacionDomicilio!: GeoPoint | null;

  @Column({ name: "tope_maximo_deuda", type: "numeric", precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  topeMaximoDeuda!: number | null;

  @Column({ type: "varchar", default: "activo" })
  estatus!: ClienteEstatus;

  @Column({ type: "varchar", length: 6, default: "blanco" })
  colorRiesgo!: ColorRiesgo;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
