import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Socio } from "../socios/socio.entity";

export const COBRADOR_ESTATUS = ["activo", "bloqueado"] as const;
export type CobradorEstatus = (typeof COBRADOR_ESTATUS)[number];

@Entity("cobradores")
export class Cobrador {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Socio, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "socio_id" })
  socio!: Socio;

  @RelationId((cobrador: Cobrador) => cobrador.socio)
  socioId!: number;

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
  estatus!: CobradorEstatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
