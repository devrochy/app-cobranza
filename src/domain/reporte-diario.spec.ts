import {
  porcentajeCobrarSemanal,
  ventanaDiaLocal,
  ventanaSemanaLocal,
} from "./reporte-diario";

describe("ventanaDiaLocal", () => {
  it("cubre de 00:00 a 23:59:59.999 del día local", () => {
    const { inicio, fin } = ventanaDiaLocal("2026-09-17");

    expect(inicio.getHours()).toBe(0);
    expect(inicio.getMinutes()).toBe(0);
    expect(fin.getHours()).toBe(23);
    expect(fin.getMinutes()).toBe(59);
    expect(fin.getSeconds()).toBe(59);
    expect(fin.getMilliseconds()).toBe(999);
    expect(inicio.getDate()).toBe(17);
    expect(fin.getDate()).toBe(17);
  });
});

describe("ventanaSemanaLocal", () => {
  it("devuelve de lunes a domingo para un miércoles", () => {
    // 2026-09-16 es miércoles.
    const { inicio, fin } = ventanaSemanaLocal("2026-09-16");

    expect(inicio.getDay()).toBe(1);
    expect(inicio.getDate()).toBe(14);
    expect(fin.getDay()).toBe(0);
    expect(fin.getDate()).toBe(20);
  });

  it("para un domingo la semana empieza el lunes anterior", () => {
    // 2026-09-20 es domingo.
    const { inicio, fin } = ventanaSemanaLocal("2026-09-20");

    expect(inicio.getDay()).toBe(1);
    expect(inicio.getDate()).toBe(14);
    expect(fin.getDate()).toBe(20);
  });
});

describe("porcentajeCobrarSemanal", () => {
  it("calcula el porcentaje con un decimal", () => {
    expect(porcentajeCobrarSemanal(250, 1000)).toBe(25);
    expect(porcentajeCobrarSemanal(1, 3)).toBe(33.3);
  });

  it("devuelve 0 cuando no hay estimado", () => {
    expect(porcentajeCobrarSemanal(100, 0)).toBe(0);
  });
});
