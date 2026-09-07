import { CallHandler } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { RequestLoggingInterceptor } from "./request-logging.interceptor";

function contextoCon(
  method: string,
  url: string,
  status: number,
  user?: unknown,
) {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ method, originalUrl: url, user }),
      getResponse: () => ({ statusCode: status }),
    }),
  } as never;
}

describe("RequestLoggingInterceptor", () => {
  let interceptor: RequestLoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
    logSpy = jest.spyOn((interceptor as unknown as { logger: { log: () => void } }).logger, "log").mockImplementation();
    errorSpy = jest.spyOn((interceptor as unknown as { logger: { error: () => void } }).logger, "error").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  function camposDe(spy: jest.SpyInstance, index = 0): Record<string, unknown> {
    return JSON.parse(spy.mock.calls[index][0] as string);
  }

  it("loguea método, ruta, status y duración como JSON en respuestas exitosas", () => {
    const next: CallHandler = { handle: () => of({}) };
    interceptor.intercept(contextoCon("POST", "/cobrador/rutas/1/clientes", 201), next).subscribe();

    const campos = camposDe(logSpy);
    expect(campos.method).toBe("POST");
    expect(campos.path).toBe("/cobrador/rutas/1/clientes");
    expect(campos.status).toBe(201);
    expect(campos.durationMs).toEqual(expect.any(Number));
    expect(campos.userId).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("incluye userId y role del request autenticado", () => {
    const next: CallHandler = { handle: () => of({}) };
    interceptor.intercept(
      contextoCon("GET", "/dashboard", 200, { sub: 42, rol: "socio" }),
      next,
    ).subscribe();

    const campos = camposDe(logSpy);
    expect(campos.userId).toBe(42);
    expect(campos.role).toBe("socio");
  });

  it("loguea el cuerpo del error en respuestas de error como JSON", () => {
    const err = Object.assign(new Error("boom"), {
      status: 400,
      response: { message: ["El teléfono de WhatsApp no es válido"] },
    });
    const next: CallHandler = { handle: () => throwError(() => err) };
    interceptor.intercept(contextoCon("POST", "/x", 400), next).subscribe({ error: () => undefined });

    const campos = camposDe(errorSpy);
    expect(campos.status).toBe(400);
    expect(JSON.parse(campos.error as string)).toEqual({
      message: ["El teléfono de WhatsApp no es válido"],
    });
  });

  it("trunca cuerpos de error muy largos", () => {
    const largo = "a".repeat(2000);
    const err = Object.assign(new Error("boom"), { status: 500, response: largo });
    const next: CallHandler = { handle: () => throwError(() => err) };
    interceptor.intercept(contextoCon("GET", "/y", 500), next).subscribe({ error: () => undefined });

    const llamado = errorSpy.mock.calls[0][0] as string;
    const campos = JSON.parse(llamado) as { error: string };
    expect(campos.error.length).toBeLessThanOrEqual(600);
    expect(campos.error.endsWith("…")).toBe(true);
  });

  it("captura el mensaje de un Error plano sin response", () => {
    const err = new Error("capa rota");
    const next: CallHandler = { handle: () => throwError(() => err) };
    interceptor.intercept(contextoCon("GET", "/z", 500), next).subscribe({ error: () => undefined });

    const campos = camposDe(errorSpy) as { error: string };
    expect(campos.error).toBe("capa rota");
  });
});
