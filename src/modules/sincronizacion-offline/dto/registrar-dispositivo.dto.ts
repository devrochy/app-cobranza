import { IsNotEmpty, IsString } from "class-validator";

/**
 * Vinculación de un dispositivo a un cobrador (HU-39). En el MVP local el IMEI y
 * el WhatsApp se "simulan": la APK envía el Android ID (`expo-application`) y el
 * teléfono autorizado del cobrador. `publicKey` es la clave pública X25519 del
 * dispositivo (HU-40).
 */
export class RegistrarDispositivoDto {
  @IsNotEmpty({ message: "El cobrador es obligatorio" })
  cobradorId!: number;

  @IsString()
  @IsNotEmpty({ message: "El IMEI es obligatorio" })
  imei!: string;

  @IsString()
  @IsNotEmpty({ message: "El número de WhatsApp es obligatorio" })
  whatsappNumber!: string;

  @IsString()
  @IsNotEmpty({ message: "La clave pública del dispositivo es obligatoria" })
  publicKey!: string;
}
