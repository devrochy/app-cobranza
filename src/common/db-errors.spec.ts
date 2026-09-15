import { isUniqueViolation } from "./db-errors";

describe("isUniqueViolation", () => {
  it("devuelve true para el código 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("devuelve false para otros códigos, null y no-objetos", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("boom")).toBe(false);
  });
});
