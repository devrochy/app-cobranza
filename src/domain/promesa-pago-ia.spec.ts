import { parsearPromesaPago } from "./promesa-pago-ia";

const HOY = new Date(2026, 7, 20); // jueves 20 ago 2026

describe("parsearPromesaPago", () => {
  it("parsea 'pago el viernes' a la próxima fecha de ese día", () => {
    const res = parsearPromesaPago("pago el viernes", HOY);
    expect(res?.fecha).toBe("2026-08-21");
  });

  it("parsea 'pago mañana' a hoy + 1", () => {
    const res = parsearPromesaPago("pago mañana", HOY);
    expect(res?.fecha).toBe("2026-08-21");
  });

  it("parsea 'pago el 25' al día del mes (este mes si aún no pasó)", () => {
    const res = parsearPromesaPago("pago el 25", HOY);
    expect(res?.fecha).toBe("2026-08-25");
  });

  it("parsea 'pago el 10' al día del mes del mes siguiente si ya pasó", () => {
    const res = parsearPromesaPago("pago el 10", HOY);
    expect(res?.fecha).toBe("2026-09-10");
  });

  it("extrae el monto cuando el cliente lo menciona con día", () => {
    const res = parsearPromesaPago("pago 100 el lunes", HOY);
    expect(res?.fecha).toBe("2026-08-24");
    expect(res?.valor).toBe(100);
  });

  it("extrae el monto con día del mes ('pago 100 el 25')", () => {
    const res = parsearPromesaPago("pago 100 el 25", HOY);
    expect(res?.fecha).toBe("2026-08-25");
    expect(res?.valor).toBe(100);
  });

  it("devuelve null si no hay fecha ('pago 100')", () => {
    expect(parsearPromesaPago("pago 100", HOY)).toBeNull();
  });

  it("devuelve null para entrada vacía", () => {
    expect(parsearPromesaPago("", HOY)).toBeNull();
    expect(parsearPromesaPago("   ", HOY)).toBeNull();
  });
});
