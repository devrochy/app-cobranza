export interface ProximaCuotaInfo {
  numeroCuota: number;
  valorEsperado: number;
  fechaVencimiento: string;
}

/**
 * HU-27: texto de respuesta a la consulta de saldo. `proximaCuota` es null si
 * no hay cuota pendiente (cliente al día o sin deuda). La moneda se pasa desde
 * la ruta (los préstamos no guardan moneda propia).
 */
export function construirTextoConsultaSaldo(
  nombreCliente: string,
  moneda: string,
  totalSaldo: number,
  proximaCuota: ProximaCuotaInfo | null,
): string {
  const lineas: string[] = [`Hola ${nombreCliente}, tu saldo pendiente total es ${totalSaldo} ${moneda}.`];

  if (totalSaldo <= 0) {
    lineas.push("No tienes saldo pendiente. ¡Estás al día!");
  } else if (proximaCuota) {
    lineas.push(
      `Próxima cuota: #${proximaCuota.numeroCuota} de ${proximaCuota.valorEsperado} ${moneda}, vence el ${proximaCuota.fechaVencimiento}.`,
    );
  }

  return lineas.join("\n");
}

/**
 * HU-27: respuesta genérica de fallback cuando el mensaje no se reconoce.
 * No deriva a humano (la derivación es HU-32, posterior).
 */
export function construirTextoFallback(): string {
  return (
    "No entendí tu solicitud. Por ejemplo, pregúntame 'cuál es mi saldo' para " +
    "conocer tu estado de cuenta."
  );
}
