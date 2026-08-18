import { formatDate } from "./date";

describe("formatDate", () => {
  it("formatea a YYYY-MM-DD en UTC", () => {
    expect(formatDate(new Date("2026-08-17T00:00:00Z"))).toBe("2026-08-17");
  });

  it("no se desplaza por la zona local (usa UTC)", () => {
    // Una fecha que en UTC es el día 17 pero en zona local podría ser el 16.
    expect(formatDate(new Date("2026-08-17T23:30:00Z"))).toBe("2026-08-17");
  });
});
