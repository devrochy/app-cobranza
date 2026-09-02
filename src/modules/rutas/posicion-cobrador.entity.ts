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
import { Cobrador } from "../cobradores/cobrador.entity";
import { Ruta } from "./ruta.entity";

/**
 * Última posición conocida del cobrador en una ruta (HU-44, MVP por polling).
 * La APK envía lat/lng periódicamente (POST /cobrador/rutas/:rutaId/posicion) y
 * el panel consulta las posiciones para el mapa en vivo. Se guarda solo la
 * última por (cobrador, ruta) vía upsert.
 */
@Entity("posicion_cobrador")
@Unique(["cobradorId", "rutaId"])
export class PosicionCobrador {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cobrador, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cobrador_id" })
  cobrador!: Cobrador;

  @RelationId((p: PosicionCobrador) => p.cobrador)
  @Column({ name: "cobrador_id" })
  cobradorId!: number;

  @ManyToOne(() => Ruta, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((p: PosicionCobrador) => p.ruta)
  @Column({ name: "ruta_id" })
  rutaId!: number;

  @Column({ type: "float" })
  latitud!: number;

  @Column({ type: "float" })
  longitud!: number;

  @CreateDateColumn({ name: "registrada_en" })
  registradaEn!: Date;
}