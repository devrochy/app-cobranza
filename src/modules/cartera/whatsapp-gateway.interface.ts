export interface WhatsappMensaje {
  conversacionId: number;
  emisor: "cliente" | "ia" | "agente";
  contenido: string;
  telefono?: string | null;
  /** Tipo de notificación automática (recordatorio, aviso_dia_cobro, confirmacion_pago, alerta_mora) para deduplicación y trazabilidad. */
  intencionDetectada?: string | null;
}

/**
 * Abstracción del canal de WhatsApp. En Fase 1 se usa la implementación simulada
 * local (persiste en `mensajes_ia`); en Fase 2 se conectará la WhatsApp Cloud API
 * real (WhatsappCloudApiGateway) seleccionada por configuración.
 */
export interface WhatsappGateway {
  enviarMensaje(mensaje: WhatsappMensaje): Promise<unknown>;
  recibirMensaje(mensaje: WhatsappMensaje): Promise<unknown>;
}

export const WHATSAPP_GATEWAY = "WHATSAPP_GATEWAY";
