import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export const PROPIETARIO_ESTATUS = ["activo", "bloqueado"] as const;
export type PropietarioEstatus = (typeof PROPIETARIO_ESTATUS)[number];

@Entity("propietarios")
export class Propietario {
  @PrimaryGeneratedColumn()
  id!: number;

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

  @Column({ length: 3 })
  moneda!: string;

  @Column({ type: "varchar", nullable: true })
  pais!: string | null;

  @Column({ name: "nombre_oficina_cobro", type: "varchar", nullable: true })
  nombreOficinaCobro!: string | null;

  @Column({ name: "dias_tolerancia_cobro", type: "int", default: 5 })
  diasToleranciaCobro!: number;

  @Column({ name: "dias_anticipacion_cobro", type: "int", default: 3 })
  diasAnticipacionCobro!: number;

  @Column({ type: "varchar", default: "activo" })
  estatus!: PropietarioEstatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
