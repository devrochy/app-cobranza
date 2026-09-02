import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { Ruta } from "./ruta.entity";

/**
 * Apertura de la ruta del día por el cobrador (HU-41): registra cuándo y desde
 * dónde se abrió la ruta (timestamp + coordenadas) para auditoría de la
 * operación de campo.
 */
@Entity("rutas_aperturas")
export class RutaApertura {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ruta, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((apertura: RutaApertura) => apertura.ruta)
  rutaId!: number;

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