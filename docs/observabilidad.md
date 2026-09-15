# Observabilidad del backend

## Métricas (Prometheus)

- **Endpoint**: `GET /metrics` (sin autenticación). Devuelve el formato de
  exposición de Prometheus (`text/plain; version=0.0.4`).
- **Métricas**:
  - `http_request_duration_seconds` (histograma; labels `method`, `route`, `status`).
  - `http_requests_total` (contador; labels `method`, `route`, `status`).
  - Métricas default de proceso/Node (solo fuera de `NODE_ENV=test`).
- **Cardinalidad**: `route` usa el patrón del router (`/rutas/:rutaId`), no la URL
  con ids.
- **Seguridad**: al no requerir auth, el despliegue debe limitar el acceso a la
  red interna o a un sidecar/scraper (no exponerlo públicamente).

Ejemplo de scrape (Prometheus):

```yaml
scrape_configs:
  - job_name: app-cobranza
    metrics_path: /metrics
    static_configs:
      - targets: ["app-cobranza:3000"]
```

## Trazas (OpenTelemetry)

- Se inicializan en `src/tracing.ts`, importado como primer módulo de `main.ts`
  (antes de cargar la app) para instrumentar HTTP y acceso a BD.
- **Habilitado solo si `OTEL_EXPORTER_OTLP_ENDPOINT` está definido** (p. ej.
  `http://localhost:4318`). Sin endpoint: no-op, sin overhead de exportación.
- `OTEL_SERVICE_NAME` ajusta el nombre del servicio (default `app-cobranza`).

## Redacción de datos sensibles

- `src/common/redact.ts` (`redactarSensibles`) redacta PII (teléfonos, correo,
  nombre/apellido, documento), credenciales/tokens y montos, y omite artefactos
  de BD (`query`, `parameters`) para no filtrar SQL.
- Se aplica en el `RequestLoggingInterceptor` al registrar el cuerpo de errores.

## Logs estructurados

- `RequestLoggingInterceptor` emite una línea JSON por request con `method`,
  `path`, `status`, `durationMs` y, si está autenticado, `userId`/`role`; en
  errores incluye `error` (cuerpo redactado y truncado a 500 chars).
