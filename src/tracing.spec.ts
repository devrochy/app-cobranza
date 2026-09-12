import { iniciarTracing } from "./tracing";

describe("iniciarTracing", () => {
  it("es no-op cuando no hay OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    expect(iniciarTracing({} as NodeJS.ProcessEnv)).toBe(false);
  });
});
