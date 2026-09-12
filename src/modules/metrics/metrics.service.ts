import { Injectable } from "@nestjs/common";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

/**
 * Métricas Prometheus del backend: duración y conteo de requests HTTP por
 * método/ruta/status. Las rutas usan el patrón del router (p. ej. `/rutas/:id`)
 * para evitar alta cardinalidad.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duración de las peticiones HTTP en segundos",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });
  private readonly httpTotal = new Counter({
    name: "http_requests_total",
    help: "Total de peticiones HTTP",
    labelNames: ["method", "route", "status"] as const,
    registers: [this.registry],
  });

  constructor() {
    // No recolectar métricas de proceso bajo Jest (unit o e2e): deja un timer
    // por instancia que impide que el proceso de pruebas cierre.
    const enTest =
      process.env.NODE_ENV === "test" || Boolean(process.env.JEST_WORKER_ID);
    if (!enTest) {
      collectDefaultMetrics({ register: this.registry });
    }
  }

  observar(method: string, route: string, status: number, segundos: number): void {
    const labels = { method, route, status: String(status) };
    this.httpDuration.labels(labels).observe(segundos);
    this.httpTotal.labels(labels).inc();
  }

  metricas(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
