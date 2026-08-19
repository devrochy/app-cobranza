export interface ClienteResumen {
  id: number;
  nombre: string;
  negocio: string | null;
}

export interface ResumenRuta {
  rutaId: number;
  cajaActual: number;
  cajaAnterior: number;
  fechaUltimaLiquidacion: string | null;
  gastosPeriodo: number;
  cobradoPeriodo: number;
  prestadoPeriodo: number;
  inyeccionesPeriodo: number;
  carteraVigente: number;
  prestamosActivos: { cantidad: number; valorTotal: number };
  comisionPorcentaje: number;
  comisionValor: number;
  clientes: ClienteResumen[];
}

export interface FlagsVisibilidad {
  mostrarCaja: boolean;
  mostrarPrestamos: boolean;
  ocultarCartera: boolean;
  mostrarCobroEstimado: boolean;
  mostrarFechaUltimaLiquidada: boolean;
}

export type ResumenRutaVisible = Omit<
  ResumenRuta,
  "cajaActual" | "cajaAnterior" | "fechaUltimaLiquidacion" | "cobradoPeriodo" | "prestadoPeriodo" | "carteraVigente" | "prestamosActivos"
> &
  Partial<
    Pick<
      ResumenRuta,
      | "cajaActual"
      | "cajaAnterior"
      | "fechaUltimaLiquidacion"
      | "cobradoPeriodo"
      | "prestadoPeriodo"
      | "carteraVigente"
      | "prestamosActivos"
    >
  >;

/**
 * Aplica los flags de visibilidad de ruta_config al resumen de la ruta,
 * ocultando los campos sensibles que el flag indica. La lista de clientes
 * y los totales de gastos/inyecciones/comisión se conservan siempre.
 */
export function aplicarVisibilidad(
  resumen: ResumenRuta,
  flags: FlagsVisibilidad,
): ResumenRutaVisible {
  const result: ResumenRutaVisible = {
    ...resumen,
    cajaActual: undefined,
    cajaAnterior: undefined,
    fechaUltimaLiquidacion: undefined,
    cobradoPeriodo: undefined,
    prestadoPeriodo: undefined,
    carteraVigente: undefined,
    prestamosActivos: undefined,
  };

  if (flags.mostrarCaja) {
    result.cajaActual = resumen.cajaActual;
    result.cajaAnterior = resumen.cajaAnterior;
  }
  if (flags.mostrarFechaUltimaLiquidada) {
    result.fechaUltimaLiquidacion = resumen.fechaUltimaLiquidacion;
  }
  if (flags.mostrarCobroEstimado) {
    result.cobradoPeriodo = resumen.cobradoPeriodo;
    result.prestadoPeriodo = resumen.prestadoPeriodo;
  }
  if (!flags.ocultarCartera) {
    result.carteraVigente = resumen.carteraVigente;
  }
  if (flags.mostrarPrestamos) {
    result.prestamosActivos = resumen.prestamosActivos;
  }
  return result;
}