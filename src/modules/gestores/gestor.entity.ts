import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Propietario } from "../propietarios/propietario.entity";

export const GESTOR_ESTATUS = ["activo", "bloqueado"] as const;
export type GestorEstatus = (typeof GESTOR_ESTATUS)[number];

@Entity("gestores")
export class Gestor {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Propietario, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "propietario_id" })
  propietario!: Propietario;

  @RelationId((gestor: Gestor) => gestor.propietario)
  propietarioId!: number;

  @Column({ unique: true })
  usuario!: string;

  @Column({ name: "password_hash", select: false })
  passwordHash!: string;

  @Column()
  nombre!: string;

  @Column()
  apellido!: string;

  @Column({ unique: true })
  correo!: string;

  @Column({ unique: true })
  telefono!: string;

  @Column({ unique: true })
  codigo!: string;

  @Column({ type: "varchar", default: "activo" })
  estatus!: GestorEstatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
