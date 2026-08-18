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
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";

export const RUTA_ESTATUS = ["activo", "bloqueado"] as const;
export type RutaEstatus = (typeof RUTA_ESTATUS)[number];

@Entity("rutas")
export class Ruta {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Socio, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "socio_id" })
  socio!: Socio;

  @RelationId((ruta: Ruta) => ruta.socio)
  socioId!: number;

  @ManyToOne(() => Cobrador, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "cobrador_id" })
  cobrador!: Cobrador;

  @RelationId((ruta: Ruta) => ruta.cobrador)
  cobradorId!: number;

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

  @Column({ type: "varchar", default: "activo" })
  estatus!: RutaEstatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
