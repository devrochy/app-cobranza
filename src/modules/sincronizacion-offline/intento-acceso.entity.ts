import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

export const INTENTO_MOTIVO = [
  "imei_no_coincide",
  "whatsapp_no_coincide",
] as const;
export type IntentoMotivo = (typeof INTENTO_MOTIVO)[number];

/**
 * Registro de un intento de acceso no autorizado (HU-42): login de un cobrador
 * cuyo IMEI/WhatsApp no coincide con el dispositivo vinculado. Sirve de alerta
 * consultable desde el panel.
 */
@Entity("intentos_acceso")
export class IntentoAcceso {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "cobrador_id", type: "int", nullable: true })
  cobradorId!: number | null;

  @Column({ type: "varchar", nullable: true })
  imei!: string | null;

  @Column({ name: "whatsapp_number", type: "varchar", nullable: true })
  whatsappNumber!: string | null;

  @Column({ type: "varchar" })
  motivo!: IntentoMotivo;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
