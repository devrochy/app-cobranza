import { calcularColorRiesgo } from "./color-riesgo";

describe("calcularColorRiesgo", () => {
  it("devuelve blanco si el cliente es nuevo (sin crédito)", () => {
    expect(calcularColorRiesgo(0, 3, true)).toBe("blanco");
  });

  it("devuelve blanco si el crédito está finalizado aunque hubo atraso previo", () => {
    expect(calcularColorRiesgo(5, 3, true)).toBe("blanco");
  });

  it("devuelve azul si no hay cuotas atrasadas", () => {
    expect(calcularColorRiesgo(0, 3, false)).toBe("azul");
  });

  it("devuelve azul si el atraso está por debajo del umbral", () => {
    expect(calcularColorRiesgo(2, 3, false)).toBe("azul");
  });

  it("devuelve rojo si el atraso alcanza el umbral (inclusivo)", () => {
    expect(calcularColorRiesgo(3, 3, false)).toBe("rojo");
  });

  it("devuelve rojo si el atraso supera el umbral", () => {
    expect(calcularColorRiesgo(4, 3, false)).toBe("rojo");
  });

  it("trata un umbral de 0 como rojo ante cualquier atraso", () => {
    expect(calcularColorRiesgo(1, 0, false)).toBe("rojo");
  });

  it("con atraso 0 y umbral 0 devuelve rojo (0 >= 0, regla inclusiva)", () => {
    expect(calcularColorRiesgo(0, 0, false)).toBe("rojo");
  });
});
