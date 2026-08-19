import { aplicarVisibilidad, ResumenRuta, FlagsVisibilidad } from "./resumen-ruta";

const resumenCompleto: ResumenRuta = {
  rutaId: 1,
  cajaActual: 1500,
  cajaAnterior: 1000,
  fechaUltimaLiquidacion: "2026-08-19",
  gastosPeriodo: 50,
  cobradoPeriodo: 200,
  prestadoPeriodo: 500,
  inyeccionesPeriodo: 300,
  carteraVigente: 1000,
  prestamosActivos: { cantidad: 3, valorTotal: 2000 },
  comisionPorcentaje: 10,
  comisionValor: 20,
  clientes: [{ id: 1, nombre: "Juan", negocio: "Tienda" }],
};

function flags(overrides: Partial<FlagsVisibilidad> = {}): FlagsVisibilidad {
  return {
    mostrarCaja: true,
    mostrarPrestamos: true,
    ocultarCartera: false,
    mostrarCobroEstimado: true,
    mostrarFechaUltimaLiquidada: true,
    ...overrides,
  };
}

describe("aplicarVisibilidad", () => {
  it("mantiene todo cuando los flags están habilitados", () => {
    const result = aplicarVisibilidad(resumenCompleto, flags());
    expect(result.cajaActual).toBe(1500);
    expect(result.cajaAnterior).toBe(1000);
    expect(result.carteraVigente).toBe(1000);
    expect(result.prestamosActivos).toBeDefined();
    expect(result.clientes).toHaveLength(1);
  });

  it("oculta la caja cuando mostrarCaja es false", () => {
    const result = aplicarVisibilidad(resumenCompleto, flags({ mostrarCaja: false }));
    expect(result.cajaActual).toBeUndefined();
    expect(result.cajaAnterior).toBeUndefined();
  });

  it("oculta la cartera cuando ocultarCartera es true", () => {
    const result = aplicarVisibilidad(resumenCompleto, flags({ ocultarCartera: true }));
    expect(result.carteraVigente).toBeUndefined();
  });

  it("oculta los préstamos cuando mostrarPrestamos es false", () => {
    const result = aplicarVisibilidad(resumenCompleto, flags({ mostrarPrestamos: false }));
    expect(result.prestamosActivos).toBeUndefined();
  });

  it("oculta cobrado/prestado cuando mostrarCobroEstimado es false", () => {
    const result = aplicarVisibilidad(resumenCompleto, flags({ mostrarCobroEstimado: false }));
    expect(result.cobradoPeriodo).toBeUndefined();
    expect(result.prestadoPeriodo).toBeUndefined();
  });

  it("oculta la fecha de última liquidación cuando mostrarFechaUltimaLiquidada es false", () => {
    const result = aplicarVisibilidad(resumenCompleto, flags({ mostrarFechaUltimaLiquidada: false }));
    expect(result.fechaUltimaLiquidacion).toBeUndefined();
  });

  it("expone la fecha de última liquidación cuando mostrarFechaUltimaLiquidada es true", () => {
    const result = aplicarVisibilidad(resumenCompleto, flags({ mostrarFechaUltimaLiquidada: true }));
    expect(result.fechaUltimaLiquidacion).toBe("2026-08-19");
  });

  it("no elimina la lista de clientes por flags de visibilidad", () => {
    const result = aplicarVisibilidad(resumenCompleto, flags());
    expect(result.clientes).toHaveLength(1);
  });
});