import { numericTransformer } from "./numeric-transformer";

describe("numericTransformer", () => {
  it("convierte string a number al leer (from)", () => {
    expect(numericTransformer.from?.("123.45")).toBe(123.45);
    expect(numericTransformer.from?.("0")).toBe(0);
    expect(numericTransformer.from?.("100")).toBe(100);
  });

  it("mantiene el valor number al escribir (to)", () => {
    expect(numericTransformer.to?.(42)).toBe(42);
    expect(numericTransformer.to?.(0)).toBe(0);
  });
});
