import { CallHandler, ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of, throwError } from "rxjs";
import { MetricsInterceptor } from "./metrics.interceptor";
import { MetricsService } from "./metrics.service";

function contexto(statusCode = 200): ExecutionContext {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ method: "POST", route: { path: "/pagos" }, baseUrl: "" }),
      getResponse: () => ({ statusCode }),
    }),
  } as unknown as ExecutionContext;
}

describe("MetricsInterceptor", () => {
  it("observa method/route/status al completar", async () => {
    const metrics = { observar: jest.fn() } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);
    const next = { handle: () => of("ok") } as CallHandler;

    await firstValueFrom(interceptor.intercept(contexto(201), next));

    expect(metrics.observar).toHaveBeenCalledWith("POST", "/pagos", 201, expect.any(Number));
  });

  it("observa también cuando el handler falla", async () => {
    const metrics = { observar: jest.fn() } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);
    const next = { handle: () => throwError(() => new Error("boom")) } as CallHandler;

    await expect(firstValueFrom(interceptor.intercept(contexto(500), next))).rejects.toThrow("boom");

    expect(metrics.observar).toHaveBeenCalledWith("POST", "/pagos", 500, expect.any(Number));
  });
});
