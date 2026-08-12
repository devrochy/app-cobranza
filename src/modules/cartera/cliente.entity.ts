import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { ColorRiesgo } from "../../domain/color-riesgo";

export const CLIENTE_ESTATUS = ["activo", "bloqueado"] as const;
export type ClienteEstatus = (typeof CLIENTE_ESTATUS)[number];

@Entity("clientes")
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

  @Column({ type: "float" })
  latitud!: number;

  @Column({ type: "float" })
  longitud!: number;

  @Column({ type: "varchar", default: "activo" })
  estatus!: ClienteEstatus;

  @Column({ type: "varchar", length: 6, default: "blanco" })
  colorRiesgo!: ColorRiesgo;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
