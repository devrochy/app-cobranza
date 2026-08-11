import { validateRequiredEnv } from "./config-validation";

describe("validateRequiredEnv", () => {
  it("no reporta variables cuando todas tienen valor", () => {
    const missing = validateRequiredEnv({
      DATABASE_URL: "postgresql://localhost/app",
      JWT_SECRET: "secret-access",
      JWT_REFRESH_SECRET: "secret-refresh",
    });

    expect(missing).toEqual([]);
  });

  it("reporta las variables ausentes o vacías", () => {
    const missing = validateRequiredEnv({
      DATABASE_URL: "postgresql://localhost/app",
      JWT_SECRET: "",
      JWT_REFRESH_SECRET: undefined,
    });

    expect(missing).toEqual(["JWT_SECRET", "JWT_REFRESH_SECRET"]);
  });

  it("trata como inválido un valor de solo espacios", () => {
    const missing = validateRequiredEnv({
      DATABASE_URL: "   ",
      JWT_SECRET: "x",
      JWT_REFRESH_SECRET: "y",
    });

    expect(missing).toEqual(["DATABASE_URL"]);
  });
});
