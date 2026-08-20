# Tarea: Configuración de límites financieros y reglas de negociación del asistente de IA (HU-25)

- **Origen:** Roadmap Fase 4 ítem 27 (docs/plan-feature-roadmap.md:56) — HU-25 (docs/APP_REQUIREMENTS.md:82). Tabla `reglas_negociacion_ia` PRD 4.2:340-341.
- **Estado:** completada
- **Fecha inicio:** 2026-08-20

## Objetivo
Exponer un endpoint admin-only para configurar y consultar los límites financieros y reglas de negociación del asistente de IA, persistidos en una fila activa única de `reglas_negociacion_ia`, sin que el motor de evaluación (HU-31) los consuma todavía.

## Fuera de alcance
- Motor de evaluación de reglas (HU-31) y su wiring con la IA.
- Consumo de estas reglas por cualquier flujo (solo CRUD de configuración).
- Historial/versionado de reglas (backlog).
- Multi-tenancy (decisión single-tenant del MVP).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad `ReglaNegociacionIa` (tabla `reglas_negociacion_ia`, sin `tenant_id`; campos `max_dias_prorroga`, `min_abono_aceptable_pct`, `max_reprogramaciones_por_cliente`, `umbral_saldo_autonomo`, `configurado_por`, `vigente_desde`).
- [x] Bloque 2: `ReglasNegociacionIaService` — `obtener` (devuelve defaults si no hay fila) y `guardar` (upsert de fila única con `configurado_por` y `vigente_desde`). Tests unitarios (4).
- [x] Bloque 3: Endpoints `GET`/`PUT /reglas-negociacion-ia` admin-only + DTO con validación (`min_abono_aceptable_pct` 0-100, enteros > 0) + registro en módulo y AppModule. e2e (9 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e` (con `--forceExit` por los crons).

## Decisiones tomadas durante la implementación
- Sin `tenant_id` (single-tenant MVP, consistente con `admin_users`/`socios`/`rutas`).
- Fila activa única (upsert); `vigente_desde` se auto-llena al guardar y `configurado_por` del token.
- `min_abono_aceptable_pct` = % del valor de la cuota (acepta decimales, columna `numeric(6,2)`).
- `umbral_saldo_autonomo` = monto en moneda (regla adicional).
- Endpoints admin-only (`@UseGuards(JwtAuthGuard, PermisoGuard)` sin `@PermisoRequerido`, como socios.controller).
- Defaults placeholder si no existe fila (no son datos de negocio reales).

## Ambigüedades resueltas con el usuario
- Pregunta: tenant → **sin tenant_id**.
- Pregunta: min_abono_pct → **% del valor de la cuota**.
- Pregunta: historial → **fila activa única (upsert)**.
- Pregunta: alcance reglas → **3 del PRD + umbral_saldo_autonomo (monto en moneda)**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK (493 tests, 60 suites).
  - `npm run test:e2e -- --forceExit` → 38 suites / 261 tests OK (incluye `reglas-negociacion-ia.e2e-spec.ts`, 9 tests).
- Archivos modificados:
  - `src/modules/reglas-negociacion-ia/regla-negociacion-ia.entity.ts` (nuevo) — tabla `reglas_negociacion_ia` (sin `tenant_id`).
  - `src/modules/reglas-negociacion-ia/reglas-negociacion-ia.service.ts` (+spec) — `obtener` (defaults si no hay fila), `guardar` (upsert fila única).
  - `src/modules/reglas-negociacion-ia/reglas-negociacion-ia.controller.ts` (nuevo) — `GET`/`PUT /reglas-negociacion-ia` admin-only.
  - `src/modules/reglas-negociacion-ia/dto/guardar-reglas-negociacion-ia.dto.ts` (nuevo) — validación.
  - `src/modules/reglas-negociacion-ia/reglas-negociacion-ia.module.ts` (nuevo) — módulo registrado en AppModule.
  - `src/app.module.ts` — registro del módulo.
  - `test/e2e/reglas-negociacion-ia.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/reglas-negociacion-ia.md` (este archivo).
- Decisiones de implementación:
  - Fila activa única: el servicio usa `find({ order: { id: "ASC" }, take: 1 })` para leer la fila vigente (evita el error de `findOne` sin condiciones).
  - `vigente_desde` es `@CreateDateColumn` (se fija al primer guardado); en un upsert posterior permanece la fecha original de vigencia (registra cuándo se fijaron las reglas actuales).
  - `configurado_por` se toma del token del admin (`req.user.sub`).
  - Endpoints admin-only: `@UseGuards(JwtAuthGuard, PermisoGuard)` sin `@PermisoRequerido` (solo admin pasa, como socios.controller).
- Revisión independiente (code-reviewer, 2026-08-20): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) `vigente_desde` ahora se fija explícitamente en cada upsert (refleja la fecha de vigencia del conjunto de reglas actual, no el alta de la fila) — entidad usa `@Column` manual y el servicio lo setea en create y update; (b) DTO con `@IsDefined()` en los 4 campos (consistencia con convención del repo); (c) e2e ampliado con casos borde: `min_abono_aceptable_pct` negativo → 400, campo faltante → 400, y `PUT` de socio → 403. Documentadas sin cambio: (d) upsert no atómico (race condition teórica single-admin MVP) → backlog sugerido de `UNIQUE`/`ON CONFLICT`; (e) teléfono de test sintético consistente con el resto del repo (no es un número real de cliente).
- Pendientes/seguimiento:
  - Motor de evaluación de reglas (HU-31) que consume estas reglas — no implementado (limitación conocida, solo CRUD de configuración).
  - Historial/versionado de reglas — backlog.
  - Multi-tenancy real (`tenant_id`) — backlog, decisión single-tenant del MVP.
  - Consumo de `umbral_saldo_autonomo` y `min_abono_aceptable_pct` en el motor de negociación (HU-31).
