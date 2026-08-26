import {
  buildTypeOrmOptions,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_DELAY_MS,
} from "./db-options";

describe("buildTypeOrmOptions", () => {
  const baseEnv: Record<string, string | undefined> = {
    DATABASE_URL: "postgresql://localhost/app",
    NODE_ENV: "development",
  };

  const makeGet = (overrides: Record<string, string | undefined> = {}) => {
    const env = { ...baseEnv, ...overrides };
    return (key: string): string | undefined => env[key];
  };

  it("usa los defaults de reintento cuando no se configura nada", () => {
    const opts = buildTypeOrmOptions(makeGet());

    expect(opts.retryAttempts).toBe(DEFAULT_RETRY_ATTEMPTS);
    expect(opts.retryDelay).toBe(DEFAULT_RETRY_DELAY_MS);
  });

  it("lee retryAttempts y retryDelay desde env", () => {
    const opts = buildTypeOrmOptions(
      makeGet({ TYPEORM_RETRY_ATTEMPTS: "1", TYPEORM_RETRY_DELAY: "500" }),
    );

    expect(opts.retryAttempts).toBe(1);
    expect(opts.retryDelay).toBe(500);
  });

  it("cae al default cuando los valores env no son enteros positivos", () => {
    const opts = buildTypeOrmOptions(
      makeGet({ TYPEORM_RETRY_ATTEMPTS: "abc", TYPEORM_RETRY_DELAY: "-5" }),
    );

    expect(opts.retryAttempts).toBe(DEFAULT_RETRY_ATTEMPTS);
    expect(opts.retryDelay).toBe(DEFAULT_RETRY_DELAY_MS);
  });

  it("mantiene url, autoLoadEntities y synchronize según NODE_ENV", () => {
    const prod = buildTypeOrmOptions(makeGet({ NODE_ENV: "production" }));
    expect(prod.url).toBe("postgresql://localhost/app");
    expect(prod.autoLoadEntities).toBe(true);
    expect(prod.synchronize).toBe(false);

    const dev = buildTypeOrmOptions(makeGet({ NODE_ENV: "development" }));
    expect(dev.synchronize).toBe(true);
  });
});