import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { MetricsService } from "./metrics.service";

/**
 * Registra la duración y el conteo de cada request HTTP en Prometheus. Usa el
 * patrón de ruta del router (`req.route.path`) para mantener baja la
 * cardinalidad.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const inicio = process.hrtime.bigint();

    const registrar = (): void => {
      const route = req.route?.path
        ? `${req.baseUrl ?? ""}${req.route.path}`
        : "desconocida";
      const segundos = Number(process.hrtime.bigint() - inicio) / 1e9;
      this.metrics.observar(req.method, route, res.statusCode, segundos);
    };

    return next.handle().pipe(tap({ next: registrar, error: registrar }));
  }
}
