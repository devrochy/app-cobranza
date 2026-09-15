import { Controller, Get, Header } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

/**
 * Endpoint de scrapeo de Prometheus. No está detrás de autenticación (lo
 * consume el scraper); el despliegue debe restringir el acceso a la red
 * interna o a un sidecar. Ver `docs/observabilidad.md`.
 */
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  obtener(): Promise<string> {
    return this.metrics.metricas();
  }
}
