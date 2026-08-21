export type TipoAcuerdo = "promesa" | "abono_parcial" | "refinanciacion";

export interface PropuestaNegociacion {
  tipo: TipoAcuerdo;
  valorPrometido: number;
  fechaPrometida: string;
  valorCuota: number;
  fechaVencimientoCuota: string;
  reprogramacionesCliente: number;
}

export interface ReglasEvaluacion {
  maxDiasProrroga: number;
  minAbonoAceptablePct: number;
  maxReprogramacionesPorCliente: number;
}

export interface ResultadoEvaluacion {
  aprobado: boolean;
  motivos: string[];
}

/**
 * HU-31: evalúa una propuesta de negociación contra las reglas configuradas
 * (HU-25), de forma determinista ("IA propone, reglas deciden", PRD 3.3).
 * Cada regla se aplica a su tipo:
 * - `min_abono_aceptable_pct` → solo `abono_parcial` (el valor prometido debe
 *   cubrir al menos ese % del valor de la cuota).
 * - `max_dias_prorroga` → cualquier acuerdo con fecha prometida: los días desde
 *   el vencimiento de la cuota hasta la fecha prometida no pueden exceder el máximo.
 * - `max_reprogramaciones_por_cliente` → solo `refinanciacion`.
 * Reglas con valor 0 (default) = no configuradas = no se aplican.
 * `umbral_saldo_autonomo` NO se evalúa aquí (difiere a HU-32).
 */
export function evaluarNegociacion(
  propuesta: PropuestaNegociacion,
  reglas: ReglasEvaluacion,
): ResultadoEvaluacion {
  const motivos: string[] = [];

  if (
    propuesta.tipo === "abono_parcial" &&
    reglas.minAbonoAceptablePct > 0
  ) {
    const minimo = (reglas.minAbonoAceptablePct / 100) * propuesta.valorCuota;
    if (propuesta.valorPrometido < minimo) {
      motivos.push("el abono no alcanza el mínimo aceptable");
    }
  }

  if (reglas.maxDiasProrroga > 0) {
    const dias = diasEntre(
      propuesta.fechaVencimientoCuota,
      propuesta.fechaPrometida,
    );
    if (dias > reglas.maxDiasProrroga) {
      motivos.push("la fecha de prórroga excede el máximo permitido");
    }
  }

  if (
    propuesta.tipo === "refinanciacion" &&
    reglas.maxReprogramacionesPorCliente > 0 &&
    propuesta.reprogramacionesCliente >= reglas.maxReprogramacionesPorCliente
  ) {
    motivos.push("se superó el número máximo de reprogramaciones");
  }

  return {
    aprobado: motivos.length === 0,
    motivos,
  };
}

function diasEntre(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(`${fechaInicio}T00:00:00Z`);
  const fin = new Date(`${fechaFin}T00:00:00Z`);
  const ms = fin.getTime() - inicio.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}