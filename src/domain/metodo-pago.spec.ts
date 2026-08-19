import { esMetodoPagoValido, METODO_PAGO, MetodoPago } from "./metodo-pago";

describe("metodo-pago", () => {
  it("define los métodos del PRD (efectivo/qr/transferencia/tarjeta/deposito)", () => {
    expect(METODO_PAGO).toEqual([
      "efectivo",
      "qr",
      "transferencia",
      "tarjeta",
      "deposito",
    ]);
  });

  it("esMetodoPagoValido acepta los métodos válidos", () => {
    for (const m of METODO_PAGO) {
      expect(esMetodoPagoValido(m)).toBe(true);
    }
  });

  it("esMetodoPagoValido rechaza valores inválidos", () => {
    expect(esMetodoPagoValido("bitcoin")).toBe(false);
    expect(esMetodoPagoValido("")).toBe(false);
    expect(esMetodoPagoValido(undefined as unknown as MetodoPago)).toBe(false);
  });
});
