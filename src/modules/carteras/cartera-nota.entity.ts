import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { Cartera } from "./cartera.entity";

@Entity("cartera_notas")
export class CarteraNota {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cartera, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "cartera_id" })
  cartera!: Cartera;

  @RelationId((nota: CarteraNota) => nota.cartera)
  carteraId!: number;

  @Column({ type: "text" })
  nota!: string;

  @Column({ name: "creado_por_rol", type: "varchar" })
  creadoPorRol!: string;

  @Column({ name: "creado_por_id", type: "int" })
  creadoPorId!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}