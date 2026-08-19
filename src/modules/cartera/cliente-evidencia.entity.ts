import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Cliente } from "./cliente.entity";

export const CLIENTE_EVIDENCIA_TIPOS = ["foto_facial", "documento_frente", "documento_reverso"] as const;
export type ClienteEvidenciaTipo = (typeof CLIENTE_EVIDENCIA_TIPOS)[number];

@Entity("cliente_evidencias")
export class ClienteEvidencia {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cliente, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cliente_id" })
  cliente!: Cliente;

  @RelationId((evidencia: ClienteEvidencia) => evidencia.cliente)
  clienteId!: number;

  @Column({ type: "varchar" })
  tipo!: ClienteEvidenciaTipo;

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
