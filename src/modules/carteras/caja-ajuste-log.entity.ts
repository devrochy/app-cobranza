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
import { Caja } from "./caja.entity";

@Entity("caja_ajustes_log")
export class CajaAjusteLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Caja, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "caja_id" })
  caja!: Caja;

  @RelationId((log: CajaAjusteLog) => log.caja)
  cajaId!: number;

  @Column({ name: "valor_anterior", type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valorAnterior!: number;

  @Column({ name: "valor_nuevo", type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  valorNuevo!: number;

  @Column()
  motivo!: string;

  @Column({ name: "actor_rol", type: "varchar" })
  actorRol!: string;

  @Column({ name: "actor_id", type: "int" })
  actorId!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
