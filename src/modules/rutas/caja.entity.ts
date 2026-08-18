import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { numericTransformer } from "../../common/numeric-transformer";
import { Ruta } from "./ruta.entity";

@Entity("caja")
export class Caja {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Ruta, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((caja: Caja) => caja.ruta)
  rutaId!: number;

  @Column({ name: "saldo_inicial", type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  saldoInicial!: number;

  @Column({ name: "saldo_actual", type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  saldoActual!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
