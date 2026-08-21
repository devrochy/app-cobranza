import { detectarTipoNegociacion, TipoNegociacion } from "./negociacion-ia";

describe("detectarTipoNegociacion", () => {
  it("detecta refinanciacion por 'refinanciar'", () => {
    expect(detectarTipoNegociacion("quiero refinanciar mi préstamo")).toBe<TipoNegociacion>("refinanciacion");
  });

  it("detecta refinanciacion por 'reprogramar'", () => {
    expect(detectarTipoNegociacion("puedo reprogramar mis cuotas")).toBe<TipoNegociacion>("refinanciacion");
  });

  it("detecta refinanciacion por 'plan de pago'", () => {
    expect(detectarTipoNegociacion("necesito un plan de pago")).toBe<TipoNegociacion>("refinanciacion");
  });

  it("detecta abono_parcial por 'abono'", () => {
    expect(detectarTipoNegociacion("quiero hacer un abono parcial")).toBe<TipoNegociacion>("abono_parcial");
  });

  it("detecta abono_parcial por 'abono' incluso con monto", () => {
    expect(detectarTipoNegociacion("puedo abonar 100")).toBe<TipoNegociacion>("abono_parcial");
  });

  it("devuelve promesa por defecto si no hay palabra de negociación", () => {
    expect(detectarTipoNegociacion("pago el viernes")).toBe<TipoNegociacion>("promesa");
  });

  it("devuelve promesa para entrada vacía", () => {
    expect(detectarTipoNegociacion("")).toBe<TipoNegociacion>("promesa");
  });
});
