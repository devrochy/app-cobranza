import { colorListaDelDia, COLOR_LISTA_DIA } from "./lista-clientes-dia";

describe("colorListaDelDia", () => {
  it("es verde si el cliente tiene visita de pago hoy (aunque tenga deuda)", () => {
    expect(colorListaDelDia(3, 3, false, true)).toBe("verde");
  });

  it("es verde si está al día (atraso bajo el umbral)", () => {
    expect(colorListaDelDia(2, 3, false, false)).toBe("verde");
  });

  it("es rojo si el atraso alcanza el umbral", () => {
    expect(colorListaDelDia(3, 3, false, false)).toBe("rojo");
  });

  it("es rojo si el atraso supera el umbral", () => {
    expect(colorListaDelDia(4, 3, false, false)).toBe("rojo");
  });

  it("es blanco si es cliente nuevo o con crédito finalizado", () => {
    expect(colorListaDelDia(0, 3, true, false)).toBe("blanco");
  });

  it("es blanco si es nuevo aunque haya visita de pago", () => {
    // Prioridad: nuevo/finalizado mantiene blanco.
    expect(colorListaDelDia(0, 3, true, true)).toBe("blanco");
  });
});

describe("COLOR_LISTA_DIA", () => {
  it("expone los 3 colores", () => {
    expect(COLOR_LISTA_DIA).toEqual(["verde", "rojo", "blanco"]);
  });
});