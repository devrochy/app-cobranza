import {
  construirTextoConsultaSaldo,
  construirTextoFallback,
  construirTextoConfirmacionPromesa,
  construirTextoPedirFechaPromesa,
  construirTextoConfirmacionAbonoParcial,
  construirTextoConfirmacionRefinanciacion,
  construirTextoNegociacionRechazada,
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

describe("construirTextoConfirmacionPromesa", () => {
  it("confirma la promesa con fecha y monto", () => {
    const texto = construirTextoConfirmacionPromesa("Juan", "2026-08-25", 100);
    expect(texto).toContain("2026-08-25");
    expect(texto).toContain("100");
    expect(texto.toLowerCase()).toContain("promesa");
  });

  it("confirma la promesa sin monto si no se mencionó", () => {
    const texto = construirTextoConfirmacionPromesa("Juan", "2026-08-25", null);
    expect(texto).toContain("2026-08-25");
  });
});

describe("construirTextoPedirFechaPromesa", () => {
  it("pide aclarar el día/fecha", () => {
    const texto = construirTextoPedirFechaPromesa().toLowerCase();
    expect(texto).toContain("día");
  });
});

describe("construirTextoConfirmacionAbonoParcial", () => {
  it("confirma el abono parcial con fecha y monto", () => {
    const texto = construirTextoConfirmacionAbonoParcial("Juan", "2026-08-25", 100);
    expect(texto.toLowerCase()).toContain("abono");
    expect(texto).toContain("100");
    expect(texto).toContain("2026-08-25");
  });
});

describe("construirTextoConfirmacionRefinanciacion", () => {
  it("confirma que la solicitud de refinanciación quedó registrada y que NO se reprograma de inmediato", () => {
    const texto = construirTextoConfirmacionRefinanciacion("Juan");
    expect(texto.toLowerCase()).toContain("refinanciación");
    expect(texto.toLowerCase()).toContain("registré");
    expect(texto.toLowerCase()).toContain("no cambian");
  });
});

describe("construirTextoNegociacionRechazada", () => {
  it("indica que la propuesta excede los límites y menciona el motivo", () => {
    const texto = construirTextoNegociacionRechazada("Juan", ["el abono no alcanza el mínimo aceptable"]);
    expect(texto.toLowerCase()).toContain("límites");
    expect(texto.toLowerCase()).toContain("mínimo");
  });

  it("indica que la propuesta excede los límites sin motivos", () => {
    const texto = construirTextoNegociacionRechazada("Juan", []);
    expect(texto.toLowerCase()).toContain("límites");
  });
});
