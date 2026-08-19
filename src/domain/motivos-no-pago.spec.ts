import { MOTIVOS_NO_PAGO, esMotivoNoPagoValido, ES_COMPROMISO_PAGO } from "./motivos-no-pago";

describe("motivos-no-pago", () => {
  it("define el catálogo fijo del PRD HU-16", () => {
    expect(MOTIVOS_NO_PAGO).toEqual([
      "no_esta",
      "no_tiene_dinero",
      "se_volo",
      "pago_ya",
      "no_hay_nadie",
      "se_traslado",
      "esta_enfermo",
      "compromiso_de_pago",
      "otro",
    ]);
  });

  it("esMotivoNoPagoValido acepta todos los motivos del catálogo", () => {
    for (const m of MOTIVOS_NO_PAGO) {
      expect(esMotivoNoPagoValido(m)).toBe(true);
    }
  });

  it("esMotivoNoPagoValido rechaza valores inválidos", () => {
    expect(esMotivoNoPagoValido("inventado")).toBe(false);
    expect(esMotivoNoPagoValido("")).toBe(false);
  });

  it("ES_COMPROMISO_PAGO es el motivo compromiso_de_pago", () => {
    expect(ES_COMPROMISO_PAGO).toBe("compromiso_de_pago");
  });
});
