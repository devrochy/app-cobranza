export type EstadoCuotaEstatus = "pendiente" | "pagada" | "atrasada";

export interface CuotaEstadoInput {
  cuotaId: number;
  numeroCuota: number;
  valorEsperado: number;
  fechaVencimiento: string;
  estatus: EstadoCuotaEstatus;
}

export interface AbonoInput {
  valor: number;
}

export interface CuotaEstado {
  cuotaId: number;
  numeroCuota: number;
  valorEsperado: number;
  fechaVencimiento: string;
  estatus: EstadoCuotaEstatus;
  abonosAcumulados: number;
  saldoPendiente: number;
}

export interface EstadoCuentaPrestamo {
  cuotas: CuotaEstado[];
  totalAbonos: number;
  saldoPendiente: number;
  proximoVencimiento: string | null;
}

/**
 * HU-54: construye el estado de cuenta de un préstamo. Los abonos se imputan
 * con FIFO desde la primera cuota no pagada (el esquema actual no vincula
 * abono→cuota: los abonos son por préstamo). Las cuotas pagadas conservan su
 * valor esperado y saldo 0.
 */
export function construirEstadoCuentaPrestamo(
  prestamo: { valor: number; numCuotas: number; tipoInteres: number },
  cuotas: CuotaEstadoInput[],
  abonos: AbonoInput[],
): EstadoCuentaPrestamo {
  const totalAbonos = abonos.reduce((suma, a) => suma + a.valor, 0);
  const cuotasOrdenadas = [...cuotas].sort((a, b) => a.numeroCuota - b.numeroCuota);

  let abonoRestante = totalAbonos;
  let abonoAcumulado = 0;
  const estado: CuotaEstado[] = cuotasOrdenadas.map((c) => {
    const esPagada = c.estatus === "pagada";

    // Una cuota pagada no tiene saldo pendiente ni acumula abonos (se pagó
    // vía pago de cuota, no vía abono).
    if (esPagada) {
      return {
        cuotaId: c.cuotaId,
        numeroCuota: c.numeroCuota,
        valorEsperado: c.valorEsperado,
        fechaVencimiento: c.fechaVencimiento,
        estatus: c.estatus,
        abonosAcumulados: abonoAcumulado,
        saldoPendiente: 0,
      };
    }

    let saldo = c.valorEsperado;
    if (abonoRestante > 0) {
      const imputado = Math.min(abonoRestante, saldo);
      saldo -= imputado;
      abonoRestante -= imputado;
      abonoAcumulado += imputado;
    }

    return {
      cuotaId: c.cuotaId,
      numeroCuota: c.numeroCuota,
      valorEsperado: c.valorEsperado,
      fechaVencimiento: c.fechaVencimiento,
      estatus: c.estatus,
      abonosAcumulados: abonoAcumulado,
      saldoPendiente: Math.max(0, saldo),
    };
  });

  const proximaNoPagada = estado.find(
    (c) => (c.estatus === "pendiente" || c.estatus === "atrasada") && c.saldoPendiente > 0,
  );

  return {
    cuotas: estado,
    totalAbonos,
    saldoPendiente: estado.reduce((suma, c) => suma + c.saldoPendiente, 0),
    proximoVencimiento: proximaNoPagada?.fechaVencimiento ?? null,
  };
}

/**
 * HU-54: genera el texto plano del reporte de estado de cuenta para enviar por
 * WhatsApp. Incluye datos del préstamo, cada cuota con su estado y saldo, y los
 * totales. La moneda se pasa desde la ruta (el préstamo no guarda moneda propia).
 */
export function construirTextoReporte(
  prestamo: { valor: number; numCuotas: number; tipoInteres: number },
  nombreCliente: string,
  estado: EstadoCuentaPrestamo,
  moneda: string,
): string {
  const lineas: string[] = [];
  lineas.push(`Estado de cuenta de ${nombreCliente}`);
  lineas.push(`Préstamo: ${prestamo.valor} ${moneda} - ${prestamo.numCuotas} cuotas`);
  lineas.push("");

  for (const c of estado.cuotas) {
    lineas.push(
      `Cuota ${c.numeroCuota} (${c.fechaVencimiento}): ${c.valorEsperado} ${moneda} - ${c.estatus} - saldo ${c.saldoPendiente} ${moneda}`,
    );
  }

  lineas.push("");
  lineas.push(`Abonos totales: ${estado.totalAbonos} ${moneda}`);
  lineas.push(`Saldo pendiente: ${estado.saldoPendiente} ${moneda}`);
  if (estado.proximoVencimiento) {
    lineas.push(`Próximo vencimiento: ${estado.proximoVencimiento}`);
  }

  return lineas.join("\n");
}
