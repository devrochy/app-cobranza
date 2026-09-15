export const MOTIVOS_NO_PAGO = [
  "no_esta",
  "no_tiene_dinero",
  "se_volo",
  "pago_ya",
  "no_hay_nadie",
  "se_traslado",
  "esta_enfermo",
  "compromiso_de_pago",
  "otro",
] as const;

export type MotivoNoPago = (typeof MOTIVOS_NO_PAGO)[number];

export const ES_COMPROMISO_PAGO: MotivoNoPago = "compromiso_de_pago";
