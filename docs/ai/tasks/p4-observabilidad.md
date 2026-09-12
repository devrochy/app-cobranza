---
estado: completada
tags: [tarea]
---

# Tarea: P4.2 — Observabilidad (métricas, trazas y redacción)

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P4**; ítem del backlog "Observabilidad avanzada: OpenTelemetry + métricas Prometheus + redacción de sensibles".
- **Estado:** completada
- **Fecha inicio:** 2026-09-12

## Objetivo
Ampliar la observabilidad del backend: métricas Prometheus por endpoint, trazas OpenTelemetry (HTTP/BD) y redacción de datos sensibles en los logs.

## Bloques (checklist TDD)
- [x] Bloque 1: `MetricsService` + `MetricsInterceptor` + `GET /metrics` (prom-client).
  - Test(s): `src/modules/metrics/metrics.service.spec.ts`, `metrics.interceptor.spec.ts`
- [x] Bloque 2: `redactarSensibles` y su uso en `RequestLoggingInterceptor`.
  - Test(s): `src/common/redact.spec.ts`, `request-logging.interceptor.spec.ts`
- [x] Bloque 3: `src/tracing.ts` (OpenTelemetry env-gated) importado en `main.ts`.
  - Test(s): `src/tracing.spec.ts`

## Decisiones tomadas durante la implementación
- Métricas: `route` usa el patrón del router (`/rutas/:rutaId`) para evitar alta cardinalidad; `/metrics` sin auth (documentado: restringir por red).
- OTel: habilitado solo si `OTEL_EXPORTER_OTLP_ENDPOINT` está definido; importado como primer módulo de `main.ts` (antes de la app).
- Redacción: PII + credenciales/tokens + montos; omite `query`/`parameters` de BD.
- `collectDefaultMetrics` se desactiva bajo Jest (`JEST_WORKER_ID`) para no dejar timers (colgaba el e2e).

## Ambigüedades resueltas con el usuario
- P4 dividido: P4.1 (helpers) y P4.2 (observabilidad, aquí).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (114 suites, 998 tests) + `npm run test:e2e` (58 suites, 421 tests) → verde.
- Archivos modificados/nuevos:
  - `src/modules/metrics/{metrics.service,metrics.interceptor,metrics.controller,metrics.module}.ts` (+ specs).
  - `src/common/redact.ts` (+ spec); `src/common/request-logging.interceptor.ts`.
  - `src/tracing.ts` (+ spec); `src/main.ts`; `src/app.module.ts`.
  - `.env.example` (vars OTEL), `docs/observabilidad.md`.
  - `package.json`/`package-lock.json` — `prom-client`, `@opentelemetry/{api,sdk-node,auto-instrumentations-node,exporter-trace-otlp-http}`.
- Pendientes/seguimiento: P4 menores (fechaLocal, helpers geo/auditoría/upload).