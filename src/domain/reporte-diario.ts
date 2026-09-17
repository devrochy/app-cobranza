/**
 * Cálculos del reporte diario por cartera (HU-18/HU-50).
 * Las ventanas usan la zona horaria local del servidor, consistente con
 * `LiquidacionesService` y la lista de clientes del día.
 */

export interface VentanaFechas {
  inicio: Date;
  fin: Date;
}

/** Referencia mínima de cliente usada en listados de reporte. */
export interface ClienteBreve {
  clienteId: number;
  nombre: string;
  /** Hora local (HH:MM) del último mensaje, cuando aplica (notificaciones). */
  hora?: string;
}

function parseFechaLocal(fecha: string): Date {
  const [year, month, day] = fecha.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Ventana [00:00, 23:59:59.999] del día local indicado (YYYY-MM-DD). */
export function ventanaDiaLocal(fecha: string): VentanaFechas {
  const inicio = parseFechaLocal(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
}

/** Ventana de la semana (lunes a domingo) que contiene la fecha local. */
export function ventanaSemanaLocal(fecha: string): VentanaFechas {
  const base = parseFechaLocal(fecha);
  const diaSemana = base.getDay();
  const offsetLunes = diaSemana === 0 ? 6 : diaSemana - 1;

  const inicio = new Date(base);
  inicio.setDate(base.getDate() - offsetLunes);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
}

/** % cobrado de la semana respecto al estimado; 0 si no hay estimado. */
export function porcentajeCobrarSemanal(cobrado: number, estimado: number): number {
  if (estimado <= 0) {
    return 0;
  }
  return Math.round((cobrado / estimado) * 1000) / 10;
}
