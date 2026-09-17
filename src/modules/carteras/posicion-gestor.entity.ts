import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { Gestor } from "../gestores/gestor.entity";
import { Cartera } from "./cartera.entity";

/**
 * Última posición conocida del gestor en una cartera (HU-44, MVP por polling).
 * La APK envía lat/lng periódicamente (POST /gestor/carteras/:carteraId/posicion) y
 * el panel consulta las posiciones para el mapa en vivo. Se guarda solo la
 * última por (gestor, cartera) vía upsert.
 */
@Entity("posicion_gestor")
@Unique(["gestorId", "carteraId"])
export class PosicionGestor {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Gestor, { onDelete: "CASCADE" })
  @JoinColumn({ name: "gestor_id" })
  gestor!: Gestor;

  @RelationId((p: PosicionGestor) => p.gestor)
  @Column({ name: "gestor_id" })
  gestorId!: number;

  @ManyToOne(() => Cartera, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cartera_id" })
  cartera!: Cartera;

  @RelationId((p: PosicionGestor) => p.cartera)
  @Column({ name: "cartera_id" })
  carteraId!: number;

  @Column({ type: "float" })
  latitud!: number;

  @Column({ type: "float" })
  longitud!: number;

  @CreateDateColumn({ name: "registrada_en" })
  registradaEn!: Date;
}