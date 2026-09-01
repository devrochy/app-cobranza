import { resolverOrigenesCors } from "./cors";

describe("resolverOrigenesCors", () => {
  it("en desarrollo permite todos los orígenes", () => {
    expect(resolverOrigenesCors(undefined, "development")).toBe(true);
  });

  it("en producción sin whitelist desactiva el cross-origin", () => {
    expect(resolverOrigenesCors(undefined, "production")).toBe(false);
  });

  it("usa la whitelist de CORS_ORIGINS cuando está definida", () => {
    expect(resolverOrigenesCors("http://localhost:8081, http://192.168.1.15:8081", "production")).toEqual([
      "http://localhost:8081",
      "http://192.168.1.15:8081",
    ]);
  });

  it("ignora entradas vacías de la whitelist", () => {
    expect(resolverOrigenesCors("http://a.com, , http://b.com", "production")).toEqual([
      "http://a.com",
      "http://b.com",
    ]);
  });
});