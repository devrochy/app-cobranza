import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";

const MAX_CUERPO_ERROR = 500;

function esBodyLogueable(valor: unknown): boolean {
  return (
    typeof valor === "string" || (typeof valor === "object" && valor !== null)
  );
}

function extraerMensaje(cuerpo: unknown): string {
  if (typeof cuerpo === "string") {
    return cuerpo.length > MAX_CUERPO_ERROR
      ? `${cuerpo.slice(0, MAX_CUERPO_ERROR)}…`
      : cuerpo;
  }
  if (cuerpo && typeof cuerpo === "object") {
    try {
      const json = JSON.stringify(cuerpo);
      return json.length > MAX_CUERPO_ERROR
        ? `${json.slice(0, MAX_CUERPO_ERROR)}…`
        : json;
    } catch {
      return "[objeto no serializable]";
    }
  }
  return "";
}

/**
 * Log de requests (diagnóstico): registra método, ruta, status y duración de
 * cada request, y para respuestas >=400 incluye el cuerpo del error (truncado).
 * NestJS no loguea excepciones HTTP manejadas (4xx/5xx explícitas) por
 * defecto, así que sin esto un rechazo de validación es invisible en los logs.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const metodo = req.method;
    const ruta = req.originalUrl ?? req.url;
    const inicio = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${metodo} ${ruta} ${res.statusCode} ${Date.now() - inicio}ms`,
          );
        },
        error: (err: unknown) => {
          const status =
            typeof (err as { status?: unknown }).status === "number"
              ? (err as { status: number }).status
              : 500;
          const cuerpo = esBodyLogueable((err as { response?: unknown }).response)
            ? extraerMensaje((err as { response: unknown }).response)
            : extraerMensaje(err);
          this.logger.error(
            `${metodo} ${ruta} ${status} ${Date.now() - inicio}ms ${cuerpo}`,
          );
        },
      }),
    );
  }
}