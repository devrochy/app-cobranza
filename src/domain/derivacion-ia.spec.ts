import { detectarDerivacion } from "./derivacion-ia";

describe("detectarDerivacion", () => {
  it("detecta solicitud de agente humano", () => {
    const res = detectarDerivacion("quiero hablar con un agente");
    expect(res.deriva).toBe(true);
    expect(res.motivo).toBe("solicitud_agente");
  });

  it("detecta solicitud por 'que me atienda alguien'", () => {
    const res = detectarDerivacion("que me atienda alguien de la empresa");
    expect(res.deriva).toBe(true);
    expect(res.motivo).toBe("solicitud_agente");
  });

  it("detecta disputa del monto", () => {
    const res = detectarDerivacion("ese monto no me corresponde");
    expect(res.deriva).toBe(true);
    expect(res.motivo).toBe("disputa_monto");
  });

  it("detecta queja", () => {
    const res = detectarDerivacion("tengo una queja sobre el cobro");
    expect(res.deriva).toBe(true);
    expect(res.motivo).toBe("queja");
  });

  it("detecta lenguaje agresivo", () => {
    const res = detectarDerivacion("te voy a demandar");
    expect(res.deriva).toBe(true);
    expect(res.motivo).toBe("lenguaje_agresivo");
  });

  it("detecta fraude sospechado", () => {
    const res = detectarDerivacion("creo que hay fraude con mi cuenta");
    expect(res.deriva).toBe(true);
    expect(res.motivo).toBe("fraude");
  });

  it("es insensible a mayúsculas y acentos", () => {
    const res = detectarDerivacion("QUIERO RECLAMAR");
    expect(res.deriva).toBe(true);
  });

  it("no deriva para un mensaje normal", () => {
    const res = detectarDerivacion("cuál es mi saldo");
    expect(res.deriva).toBe(false);
    expect(res.motivo).toBeNull();
  });

  it("no deriva para entrada vacía", () => {
    const res = detectarDerivacion("");
    expect(res.deriva).toBe(false);
  });

  it("no deriva para palabras benignas que contienen 'rat' (regresión de falso positivo)", () => {
    expect(detectarDerivacion("quiero tratar mi deuda").deriva).toBe(false);
    expect(detectarDerivacion("quiero un contrato").deriva).toBe(false);
    expect(detectarDerivacion("gratis").deriva).toBe(false);
    expect(detectarDerivacion("tratamiento").deriva).toBe(false);
  });

  it("detecta lenguaje agresivo por un insulto inequívoco", () => {
    expect(detectarDerivacion("malnacido").motivo).toBe("lenguaje_agresivo");
    expect(detectarDerivacion("eres un mentiroso").motivo).toBe("lenguaje_agresivo");
  });
});