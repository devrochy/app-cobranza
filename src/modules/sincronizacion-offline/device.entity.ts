import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export const DEVICE_ESTADO = ["activo", "revocado", "pendiente_revalidacion"] as const;
export type DeviceEstado = (typeof DEVICE_ESTADO)[number];

/**
 * Dispositivo del gestor (precursor de la Épica 8, HU-39 a HU-43).
 * En el MVP local solo se usan `codigo` (uuid), `apiKeyHash`, `carteraId` y
 * `estado` para la sincronización offline (HU-64); `gestorId`, `imei` y
 * `whatsappNumber` quedan null hasta la vinculación real de la Épica 8.
 */
@Entity("devices")
export class Device {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, type: "uuid" })
  codigo!: string;

  @Column({ name: "api_key_hash" })
  apiKeyHash!: string;

  @Column({ name: "gestor_id", type: "int", nullable: true })
  gestorId!: number | null;

  @Column({ type: "varchar", nullable: true })
  imei!: string | null;

  @Column({ name: "whatsapp_number", type: "varchar", nullable: true })
  whatsappNumber!: string | null;

  /** Clave pública X25519 del dispositivo (HU-40: cifrado del snapshot). */
  @Column({ name: "public_key", type: "text", nullable: true })
  publicKey!: string | null;

  /** @deprecated MVP: el vínculo correcto es device↔gestor (gestor_id). */
  @Column({ name: "cartera_id", type: "int", nullable: true })
  carteraId!: number | null;

  @Column({ type: "varchar", default: "activo" })
  estado!: DeviceEstado;

  @Column({ name: "fecha_vinculacion", type: "timestamp", nullable: true })
  fechaVinculacion!: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}