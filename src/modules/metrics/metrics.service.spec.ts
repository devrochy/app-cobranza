import { MetricsService } from "./metrics.service";

describe("MetricsService", () => {
  it("expone las métricas de requests con sus labels", async () => {
    const service = new MetricsService();

    service.observar("GET", "/rutas/:rutaId", 200, 0.05);
    service.observar("GET", "/rutas/:rutaId", 500, 0.2);

    const texto = await service.metricas();

    expect(texto).toContain("http_requests_total");
    expect(texto).toContain('method="GET"');
    expect(texto).toContain('route="/rutas/:rutaId"');
    expect(texto).toContain('status="200"');
    expect(texto).toContain('status="500"');
    expect(texto).toContain("http_request_duration_seconds_bucket");
    expect(service.contentType()).toContain("text/plain");
  });
});
