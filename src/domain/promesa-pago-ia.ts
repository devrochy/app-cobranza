export interface PromesaPagoParseada {
  /** Fecha prometida en formato YYYY-MM-DD. */
  fecha: string;
  /** Monto prometido si el cliente lo mencionó explícitamente. */
  valor?: number;
}

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function formatFecha(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sumarDias(base: Date, dias: number): Date {
  const r = new Date(base);
  r.setDate(r.getDate() + dias);
  return r;
}

/**
 * HU-28: parsea de forma determinista una promesa de pago en lenguaje natural
 * (MVP Fase 1, sin LLM). Reconoce fechas relativas (hoy, mañana, pasado mañana,
 * próxima semana), nombre del día ("el viernes") y día del mes ("el 25"), más un
 * monto opcional ("pago 100"). Devuelve null si no puede extraer una fecha.
 */
export function parsearPromesaPago(
  mensaje: string | null | undefined,
  hoy: Date = new Date(),
): PromesaPagoParseada | null {
  const normalizado = (mensaje ?? "").toLowerCase().trim();
  if (!normalizado) {
    return null;
  }

  let fecha: Date | null = null;

  if (normalizado.includes("pasado mañana")) {
    fecha = sumarDias(hoy, 2);
  } else if (normalizado.includes("mañana")) {
    fecha = sumarDias(hoy, 1);
  } else if (normalizado.includes("hoy")) {
    fecha = new Date(hoy);
  } else if (normalizado.includes("próxima semana") || normalizado.includes("proxima semana")) {
    fecha = sumarDias(hoy, 7);
  } else {
    // Nombre del día de la semana.
    for (const [nombre, dia] of Object.entries(DIAS_SEMANA)) {
      if (normalizado.includes(nombre)) {
        const diff = (dia - hoy.getDay() + 7) % 7;
        fecha = sumarDias(hoy, diff === 0 ? 7 : diff);
        break;
      }
    }

    if (!fecha) {
      // Día del mes: "el <N>".
      const match = normalizado.match(/\bel\s+(\d{1,2})\b/);
      if (match) {
        const dia = Number(match[1]);
        if (dia >= 1 && dia <= 31) {
          const anio = hoy.getFullYear();
          const mes = hoy.getMonth();
          let objetivo = new Date(anio, mes, dia);
          if (objetivo.getDate() !== dia) {
            return null; // día inválido para el mes (ej. 31 en mes de 30)
          }
          if (objetivo <= hoy) {
            objetivo = new Date(anio, mes + 1, dia);
            if (objetivo.getDate() !== dia) {
              return null;
            }
          }
          fecha = objetivo;
        }
      }
    }
  }

  if (!fecha) {
    return null;
  }

  // Monto: número que no sea el día del mes (no precedido por "el").
  let valor: number | undefined;
  const numeroRegex = /\b(\d{1,3}(?:[.,]\d+)?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = numeroRegex.exec(normalizado)) !== null) {
    const num = Number(m[1].replace(",", "."));
    const antes = normalizado.slice(0, m.index).trimEnd();
    const esDiaDelMes = antes.endsWith("el");
    if (!esDiaDelMes && Number.isFinite(num) && num > 0) {
      valor = num;
      break;
    }
  }

  const resultado: PromesaPagoParseada = { fecha: formatFecha(fecha) };
  if (valor !== undefined) {
    resultado.valor = valor;
  }
  return resultado;
}
