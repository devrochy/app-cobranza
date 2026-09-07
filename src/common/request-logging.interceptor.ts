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
      if (json !== "{}") {
        return json.length > MAX_CUERPO_ERROR
          ? `${json.slice(0, MAX_CUERPO_ERROR)}…`
          : json;
      }
      const message = (cuerpo as { message?: unknown }).message;
      if (typeof message === "string") {
        return message.length > MAX_CUERPO_ERROR
          ? `${message.slice(0, MAX_CUERPO_ERROR)}…`
          : message;
      }
      return "[objeto no serializable]";
    } catch {
      return "[objeto no serializable]";
    }
  }
  return "";
}

/**
 * Log de requests (diagnóstico) en formato estructurado (JSON), para
 * observabilidad: registra método, ruta, status, duración y, cuando el request
 * está autenticado, la identidad (userId/role). En respuestas >=400 incluye el
 * cuerpo del error (truncado). NestJS no loguea excepciones HTTP manejadas
 * (4xx/5xx explícitas) por defecto, así que sin esto un rechazo de validación
 * es invisible en los logs. JSON parseable = debugging más rápido y confiable.
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

    const base = () => {
      const user = req.user as { sub?: number; rol?: string } | undefined;
      const entrada: Record<string, unknown> = {
        method: metodo,
        path: ruta,
        status: res.statusCode,
        durationMs: Date.now() - inicio,
      };
      if (user?.sub !== undefined) {
        entrada.userId = user.sub;
      }
      if (user?.rol) {
        entrada.role = user.rol;
      }
      return entrada;
    };

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(JSON.stringify(base()));
        },
        error: (err: unknown) => {
          const status =
            typeof (err as { status?: unknown }).status === "number"
              ? (err as { status: number }).status
              : 500;
          const cuerpo = esBodyLogueable((err as { response?: unknown }).response)
            ? extraerMensaje((err as { response: unknown }).response)
            : extraerMensaje(err);
          this.logger.error(JSON.stringify({ ...base(), status, error: cuerpo }));
        },
      }),
    );
  }
}
