export const METODO_PAGO = [
  "efectivo",
  "qr",
  "transferencia",
  "tarjeta",
  "deposito",
] as const;

export type MetodoPago = (typeof METODO_PAGO)[number];
