import { addDays, calcularFechaVencimiento, diaAnclaDe, esDiaDeCobro, fechaGeneracionCobro, periodoDeFecha } from "./cobro-fecha";

describe("cobro-fecha (HU-60)", () => {
  describe("periodoDeFecha", () => {
    it("devuelve el periodo YYYY-MM en UTC", () => {
      expect(periodoDeFecha(new Date("2026-08-15T00:00:00Z"))).toBe("2026-08");
    });
  });

  describe("calcularFechaVencimiento", () => {
    it("usa el día ancla del mes", () => {
      expect(calcularFechaVencimiento("2026-08", 15)).toBe("2026-08-15");
    });

    it("clampa al último día si el mes no tiene el día ancla (febrero no bisiesto)", () => {
      expect(calcularFechaVencimiento("2026-02", 31)).toBe("2026-02-28");
    });

    it("clampa respetando año bisiesto", () => {
      expect(calcularFechaVencimiento("2024-02", 31)).toBe("2024-02-29");
    });

    it("clampa a 30 en meses de 30 días", () => {
      expect(calcularFechaVencimiento("2026-04", 31)).toBe("2026-04-30");
    });
  });

  describe("esDiaDeCobro", () => {
    it("true cuando hoy es el vencimiento del periodo actual", () => {
      expect(esDiaDeCobro(new Date("2026-08-15T00:00:00Z"), 15)).toBe(true);
    });

    it("false cuando hoy no es el día ancla", () => {
      expect(esDiaDeCobro(new Date("2026-08-14T00:00:00Z"), 15)).toBe(false);
    });
  });

  describe("fechaGeneracionCobro", () => {
    it("genera diasAnticipacion días antes del vencimiento", () => {
      expect(fechaGeneracionCobro("2026-08", 15, 3)).toBe("2026-08-12");
    });

    it("con 0 días genera el mismo día del vencimiento", () => {
      expect(fechaGeneracionCobro("2026-08", 15, 0)).toBe("2026-08-15");
    });
  });

  describe("diaAnclaDe", () => {
    it("usa el día del createdAt del socio (UTC)", () => {
      expect(diaAnclaDe(new Date("2026-01-31T10:00:00Z"))).toBe(31);
    });
  });

  describe("addDays", () => {
    it("suma días en UTC", () => {
      expect(addDays(new Date("2026-08-15T00:00:00Z"), 3).toISOString()).toBe(
        "2026-08-18T00:00:00.000Z",
      );
    });
  });
});