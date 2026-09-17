import {
  calcularDeltas,
  conteosDesdeSnapshot,
  EstadisticasConteos,
} from "./estadisticas-cartera";

const base: EstadisticasConteos = {
  totalClientes: 10,
  clientesAtrasados: 4,
  clientesVencidos: 3,
  sinVisitaHoy: 2,
  sinVisitaDesdeUltimaLiquidada: 5,
  conPrestamosNuevos: 1,
  conMasDeUnPrestamo: 2,
  clientesNuevos: 0,
};

describe("calcularDeltas", () => {
  it("resta el anterior del actual campo a campo", () => {
    const anterior: EstadisticasConteos = {
      ...base,
      totalClientes: 8,
      clientesAtrasados: 6,
      sinVisitaHoy: 2,
    };

    const deltas = calcularDeltas(base, anterior);

    expect(deltas.totalClientes).toBe(2);
    expect(deltas.clientesAtrasados).toBe(-2);
    expect(deltas.sinVisitaHoy).toBe(0);
  });

  it("devuelve null en todos los campos cuando no hay anterior", () => {
    const deltas = calcularDeltas(base, null);

    expect(Object.values(deltas).every((valor) => valor === null)).toBe(true);
  });
});

describe("conteosDesdeSnapshot", () => {
  it("extrae solo los campos de estadísticas", () => {
    const snapshot = { ...base, id: 7, carteraId: 1, fecha: "2026-09-16" };

    expect(conteosDesdeSnapshot(snapshot)).toEqual(base);
  });
});
