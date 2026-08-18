import { ajustarDiaHabil } from "./dias-no-laborables";

function iso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

describe("ajustarDiaHabil", () => {
  it("deja intacta una fecha que no es domingo (solo_domingos)", () => {
    // 2026-08-12 es miércoles
    const f = new Date("2026-08-12T00:00:00Z");
    expect(iso(ajustarDiaHabil(f, "solo_domingos"))).toBe("2026-08-12");
  });

  it("atrasa un domingo al lunes siguiente (solo_domingos)", () => {
    // 2026-08-16 es domingo
    const f = new Date("2026-08-16T00:00:00Z");
    expect(iso(ajustarDiaHabil(f, "solo_domingos"))).toBe("2026-08-17");
  });

  it("trata domingos_y_feriados igual que solo_domingos en MVP (sin feriados)", () => {
    const f = new Date("2026-08-16T00:00:00Z"); // domingo
    expect(iso(ajustarDiaHabil(f, "domingos_y_feriados"))).toBe("2026-08-17");
  });

  it("respeta fechas UTC al cruzar límite de mes", () => {
    // 2026-08-30 es domingo -> 2026-08-31 (lunes)
    const f = new Date("2026-08-30T00:00:00Z");
    expect(iso(ajustarDiaHabil(f, "solo_domingos"))).toBe("2026-08-31");
  });
});
