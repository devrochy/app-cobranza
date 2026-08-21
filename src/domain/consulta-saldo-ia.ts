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

/**
 * HU-28: confirmación al cliente cuando se registra su promesa de pago.
 */
export function construirTextoConfirmacionPromesa(
  nombreCliente: string,
  fecha: string,
  valor: number | null,
): string {
  const monto = valor !== null && valor !== undefined ? ` de ${valor}` : "";
  return `Hola ${nombreCliente}, registré tu promesa de pago${monto} para el ${fecha}. ¡Gracias por tu compromiso!`;
}

/**
 * HU-28: pedir aclaración cuando no se logra extraer la fecha de la promesa.
 */
export function construirTextoPedirFechaPromesa(): string {
  return "No pude identificar para qué día quieres registrar la promesa. " +
    "Por ejemplo, dime 'pago el viernes' o 'pago el 25'.";
}

/**
 * HU-29: confirmación de un acuerdo de abono parcial (no se ejecuta el pago,
 * solo se registra el acuerdo conversacional).
 */
export function construirTextoConfirmacionAbonoParcial(
  nombreCliente: string,
  fecha: string,
  valor: number,
): string {
  return `Hola ${nombreCliente}, registré tu acuerdo de abono parcial de ${valor} para el ${fecha}. ¡Gracias!`;
}

/**
 * HU-29: confirmación de que la solicitud de refinanciación quedó registrada.
 * Deja claro que la reprogramación de cuotas NO se ejecuta de inmediato (se
 * coordina; la ejecución es una iteración transaccional posterior).
 */
export function construirTextoConfirmacionRefinanciacion(nombreCliente: string): string {
  return (
    `Hola ${nombreCliente}, registré tu solicitud de refinanciación. ` +
    "Tu plan de pagos será revisado y coordinado. Por ahora tus cuotas no cambian."
  );
}

/**
 * HU-31: respuesta cuando la evaluación de reglas rechaza una negociación.
 * Indica que la propuesta excede los límites permitidos (sin derivar; HU-32).
 */
export function construirTextoNegociacionRechazada(
  nombreCliente: string,
  motivos: string[],
): string {
  const lineas = [`Hola ${nombreCliente}, no puedo confirmar tu propuesta: excede los límites permitidos.`];
  for (const motivo of motivos) {
    lineas.push(`- ${motivo}`);
  }
  return lineas.join("\n");
}
