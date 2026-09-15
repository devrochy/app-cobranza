import { METODO_PAGO } from "./metodo-pago";

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
});
