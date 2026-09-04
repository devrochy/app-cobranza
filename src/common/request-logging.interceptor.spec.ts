import { CallHandler } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { RequestLoggingInterceptor } from "./request-logging.interceptor";

function contextoCon(method: string, url: string, status: number) {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ method, originalUrl: url }),
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

  it("loguea método, ruta, status y duración cuando la respuesta es exitosa", () => {
    const next: CallHandler = { handle: () => of({}) };
    interceptor.intercept(contextoCon("POST", "/cobrador/rutas/1/clientes", 201), next).subscribe();
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^POST \/cobrador\/rutas\/1\/clientes 201 \d+ms$/));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("loguea el cuerpo del error en respuestas de error", () => {
    const err = Object.assign(new Error("boom"), {
      status: 400,
      response: { message: ["El teléfono de WhatsApp no es válido"] },
    });
    const next: CallHandler = { handle: () => throwError(() => err) };
    interceptor.intercept(contextoCon("POST", "/x", 400), next).subscribe({ error: () => undefined });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('{"message":["El teléfono de WhatsApp no es válido"]}'),
    );
  });

  it("trunca cuerpos de error muy largos", () => {
    const largo = "a".repeat(2000);
    const err = Object.assign(new Error("boom"), { status: 500, response: largo });
    const next: CallHandler = { handle: () => throwError(() => err) };
    interceptor.intercept(contextoCon("GET", "/y", 500), next).subscribe({ error: () => undefined });
    const llamado = errorSpy.mock.calls[0][0] as string;
    expect(llamado.length).toBeLessThanOrEqual(600);
    expect(llamado.endsWith("…")).toBe(true);
  });
});