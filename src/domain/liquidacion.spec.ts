import { calcularComision, calcularVentanaPeriodo, PERIODO_LIQUIDACION } from "./liquidacion";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("calcularVentanaPeriodo", () => {
  const cierre = new Date(2026, 7, 19, 15, 0, 0, 0);

  it("define la ventana diaria como el día del cierre", () => {
    const { inicio, fin } = calcularVentanaPeriodo("diario", cierre);
    expect(ymd(inicio)).toBe("2026-08-19");
    expect(ymd(fin)).toBe("2026-08-19");
  });

  it("define la ventana semanal como los últimos 7 días", () => {
    const { inicio } = calcularVentanaPeriodo("semanal", cierre);
    expect(ymd(inicio)).toBe("2026-08-13");
  });

  it("define la ventana quincenal como los últimos 14 días", () => {
    const { inicio } = calcularVentanaPeriodo("quincenal", cierre);
    expect(ymd(inicio)).toBe("2026-08-06");
  });

  it("define la ventana mensual como los últimos 30 días", () => {
    const { inicio } = calcularVentanaPeriodo("mensual", cierre);
    expect(ymd(inicio)).toBe("2026-07-21");
  });
});

describe("calcularComision", () => {
  it("devuelve 0 si la comisión no está activa", () => {
    expect(calcularComision(1000, false, 10)).toBe(0);
  });

  it("calcula el porcentaje sobre el total cobrado del periodo", () => {
    expect(calcularComision(1000, true, 10)).toBe(100);
  });

  it("redondea a 2 decimales", () => {
    expect(calcularComision(333.33, true, 5)).toBe(16.67);
  });
});

describe("PERIODO_LIQUIDACION", () => {
  it("expone los 4 periodos", () => {
    expect(PERIODO_LIQUIDACION).toEqual(["diario", "semanal", "quincenal", "mensual"]);
  });
});