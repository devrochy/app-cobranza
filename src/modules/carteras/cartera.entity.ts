import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { numericTransformer } from "../../common/numeric-transformer";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";

export const CARTERA_ESTATUS = ["activo", "bloqueado"] as const;
export type CarteraEstatus = (typeof CARTERA_ESTATUS)[number];

@Entity("carteras")
export class Cartera {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Propietario, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "propietario_id" })
  propietario!: Propietario;

  @RelationId((cartera: Cartera) => cartera.propietario)
  propietarioId!: number;

  @ManyToOne(() => Gestor, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "gestor_id" })
  gestor!: Gestor;

  @RelationId((cartera: Cartera) => cartera.gestor)
  gestorId!: number;

  @Column()
  nombre!: string;

  @Column({ type: "varchar", nullable: true })
  descripcion!: string | null;

  @Column({ type: "numeric", precision: 6, scale: 2, transformer: numericTransformer })
  tipoInteres!: number;

  @Column({ type: "int" })
  numCuotas!: number;

  @Column({ length: 3 })
  moneda!: string;

  @Column({ name: "costo_cobro", type: "numeric", precision: 10, scale: 2, default: 0, transformer: numericTransformer })
  costoCobro!: number;

  @Column({ type: "varchar", default: "activo" })
  estatus!: CarteraEstatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
