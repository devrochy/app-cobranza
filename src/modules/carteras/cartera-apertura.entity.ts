import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Cartera } from "./cartera.entity";

/**
 * Apertura de la cartera del día por el gestor (HU-41): registra cuándo y desde
 * dónde se abrió la cartera (timestamp + coordenadas) para auditoría de la
 * operación de campo.
 */
@Entity("carteras_aperturas")
export class CarteraApertura {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cartera, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "cartera_id" })
  cartera!: Cartera;

  @RelationId((apertura: CarteraApertura) => apertura.cartera)
  carteraId!: number;

  @Column({ type: "date" })
  fecha!: string;

  @Column({ name: "hora_inicio", type: "varchar", nullable: true })
  horaInicio!: string | null;

  @Column({ type: "numeric", precision: 9, scale: 6, nullable: true })
  latitud!: number | null;

  @Column({ type: "numeric", precision: 9, scale: 6, nullable: true })
  longitud!: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}