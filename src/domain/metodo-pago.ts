export const METODO_PAGO = [
  "efectivo",
  "qr",
  "transferencia",
  "tarjeta",
  "deposito",
] as const;

export type MetodoPago = (typeof METODO_PAGO)[number];

export function esMetodoPagoValido(valor: unknown): valor is MetodoPago {
  return typeof valor === "string" && (METODO_PAGO as readonly string[]).includes(valor);
}
