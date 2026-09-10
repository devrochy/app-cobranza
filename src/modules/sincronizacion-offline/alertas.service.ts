import { Injectable } from "@nestjs/common";

export interface IntentoAccesoAlerta {
  cobradorId: number | null;
  imei: string | null;
  whatsappNumber: string | null;
  motivo: string;
}

/**
 * Punto único de alertas de seguridad (HU-42). En el MVP la alerta se consulta
 * desde el panel (vía `intentos_acceso`); el envío real por WhatsApp se
 * integrará aquí sin tocar a los consumidores.
 */
@Injectable()
export class AlertasService {
  async notificarIntentoNoAutorizado(alerta: IntentoAccesoAlerta): Promise<void> {
    // Mock: sin envío real en el MVP local.
    void alerta;
  }
}
