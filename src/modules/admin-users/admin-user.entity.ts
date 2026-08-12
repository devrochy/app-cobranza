import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export type AdminUserEstado = "activo" | "bloqueado";

@Entity("admin_users")
export class AdminUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  usuario!: string;

  @Column({ name: "password_hash", select: false })
  passwordHash!: string;

  @Column({ type: "varchar", nullable: true })
  nombre!: string | null;

  @Column({ type: "varchar", nullable: true })
  apellido!: string | null;

  @Column({ type: "varchar", nullable: true })
  correo!: string | null;

  @Column({ type: "varchar", nullable: true })
  telefono!: string | null;

  @Column({ type: "varchar", default: "activo" })
  estado!: AdminUserEstado;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
