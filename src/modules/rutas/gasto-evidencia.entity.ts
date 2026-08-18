import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Gasto } from "./gasto.entity";

@Entity("gasto_evidencias")
export class GastoEvidencia {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Gasto, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "gasto_id" })
  gasto!: Gasto;

  @RelationId((evidencia: GastoEvidencia) => evidencia.gasto)
  gastoId!: number;

  @Column({ name: "ruta_archivo", type: "varchar" })
  rutaArchivo!: string;

  @Column({ name: "nombre_original", type: "varchar" })
  nombreOriginal!: string;

  @Column({ type: "varchar" })
  mimetype!: string;

  @Column({ type: "int" })
  tamaño!: number;

  @Column({ name: "creado_por_rol", type: "varchar" })
  creadoPorRol!: string;

  @Column({ name: "creado_por_id", type: "int" })
  creadoPorId!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
