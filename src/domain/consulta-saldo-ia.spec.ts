import {
  construirTextoConsultaSaldo,
  construirTextoFallback,
  ProximaCuotaInfo,
} from "./consulta-saldo-ia";

describe("construirTextoConsultaSaldo", () => {
  it("genera el texto con saldo total y próxima cuota", () => {
    const proxima: ProximaCuotaInfo = {
      numeroCuota: 3,
      valorEsperado: 120,
      fechaVencimiento: "2026-09-08",
    };
    const texto = construirTextoConsultaSaldo("Juan Pérez", "BOB", 360, proxima);

    expect(texto).toContain("Juan Pérez");
    expect(texto).toContain("360 BOB");
    expect(texto).toContain("#3");
    expect(texto).toContain("120 BOB");
    expect(texto).toContain("2026-09-08");
  });

  it("menciona el saldo aunque no haya próxima cuota pendiente", () => {
    const texto = construirTextoConsultaSaldo("Ana", "BOB", 0, null);

    expect(texto).toContain("0 BOB");
    expect(texto).toContain("Ana");
  });

  it("indica cuando no hay saldo pendiente", () => {
    const texto = construirTextoConsultaSaldo("Ana", "BOB", 0, null);
    expect(texto.toLowerCase()).toContain("no tienes saldo");
  });
});

describe("construirTextoFallback", () => {
  it("genera un mensaje genérico de no entendido", () => {
    const texto = construirTextoFallback();
    expect(texto).toContain("No entendí");
    expect(texto.toLowerCase()).toContain("saldo");
  });
});
