import { diasDeMora, tipoPagoDesdeDiasEntreCuotas } from "./tarjeta-cliente";

describe("tipoPagoDesdeDiasEntreCuotas", () => {
  it("devuelve null si no hay préstamos", () => {
    expect(tipoPagoDesdeDiasEntreCuotas([])).toBeNull();
  });

  it("diario para 1 día", () => {
    expect(tipoPagoDesdeDiasEntreCuotas([1])).toBe("diario");
  });

  it("semanal para 7 días", () => {
    expect(tipoPagoDesdeDiasEntreCuotas([7])).toBe("semanal");
  });

  it("quincenal para 15 días", () => {
    expect(tipoPagoDesdeDiasEntreCuotas([15])).toBe("quincenal");
  });

  it("mensual para 30 días", () => {
    expect(tipoPagoDesdeDiasEntreCuotas([30])).toBe("mensual");
  });

  it("Varios si los préstamos difieren en periodicidad", () => {
    expect(tipoPagoDesdeDiasEntreCuotas([7, 30])).toBe("Varios");
  });
});

describe("diasDeMora", () => {
  it("devuelve 0 si no hay fecha vencida", () => {
    expect(diasDeMora(null)).toBe(0);
  });

  it("devuelve 0 si la fecha es hoy", () => {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    expect(diasDeMora(fecha)).toBe(0);
  });

  it("devuelve el número de días transcurridos desde una fecha pasada", () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 3);
    const fecha = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(ayer.getDate()).padStart(2, "0")}`;
    expect(diasDeMora(fecha)).toBe(3);
  });

  it("acepta un objeto Date (getRawOne de Postgres)", () => {
    const haceDos = new Date();
    haceDos.setDate(haceDos.getDate() - 2);
    haceDos.setHours(0, 0, 0, 0);
    expect(diasDeMora(haceDos)).toBe(2);
  });

  it("devuelve 0 para una fecha futura", () => {
    const futura = new Date();
    futura.setDate(futura.getDate() + 5);
    const fecha = `${futura.getFullYear()}-${String(futura.getMonth() + 1).padStart(2, "0")}-${String(futura.getDate()).padStart(2, "0")}`;
    expect(diasDeMora(fecha)).toBe(0);
  });

  it("devuelve 0 para una fecha inválida (NaN)", () => {
    expect(diasDeMora("no-es-una-fecha")).toBe(0);
  });
});