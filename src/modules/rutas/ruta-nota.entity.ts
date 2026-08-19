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
import { Ruta } from "./ruta.entity";

@Entity("ruta_notas")
export class RutaNota {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((nota: RutaNota) => nota.ruta)
  rutaId!: number;

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