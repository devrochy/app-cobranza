# Tarea: API de sincronización de eventos offline con idempotencia por dispositivo (HU-64)

- **Origen:** Roadmap Fase 6 ítem 39 (docs/plan-feature-roadmap.md:74) — HU-64 (docs/APP_REQUIREMENTS.md:130). Tabla `sincronizacion_offline` PRD 4.2:358-359; modo offline :371; sección 6.5 :431-436 (MVP solo API, APK real Fase 2).
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-26

## Objetivo
Construir en el backend la API de sincronización de eventos offline: registro de dispositivos con API key, ingestión de lotes de eventos con deduplicación idempotente por `(dispositivo, evento_id_cliente)`, ack por evento y descarga del snapshot del día para la APK. Los eventos se registran pero **no** se aplican al dominio (Fase 2).

## Fuera de alcance
- Aplicar los eventos al dominio (visitas/pagos/abonos/gastos/promesas/cambios de cliente).
- APK offline real (Fase 2).
- Login de cobrador y vinculación IMEI/WhatsApp (Épica 8; `devices` es precursor).
- Evidencias de gasto en el payload (archivos).
- Validación de negocio de los payloads (solo validación de forma + estado).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidades `SincronizacionOffline` (índice único `device+evento_id_cliente`) y `Device` (precursor Épica 8 con `api_key_hash`, `ruta_id`) + módulo `sincronizacion-offline`.
  - Test(s): `src/modules/sincronizacion-offline/*.entity` (config).
- [x] Bloque 2: `DevicesService` — `registrar` (admin, genera codigo+apiKey, hash) y `autenticar(apiKey)`; `DeviceApiKeyGuard`.
  - Test(s): `src/modules/sincronizacion-offline/devices.service.spec.ts`, `device-api-key.guard.spec.ts`.
- [x] Bloque 3: `SincronizacionOfflineService.ingestir(deviceId, eventos)` — dedup por `(device, eventoIdCliente)` (duplicado→ack, nuevo→persiste pendiente→sincronizado, error→estado error), ack por evento.
  - Test(s): `src/modules/sincronizacion-offline/sincronizacion-offline.service.spec.ts`.
- [x] Bloque 4: Controller — `POST /devices` (admin), `POST /sync-offline/eventos` (device auth), `GET /sync-offline/dia` (snapshot del día reutilizando lista-clientes-dia/trayectorias) + e2e.
  - Test(s): `src/modules/sincronizacion-offline/sincronizacion-offline.controller.spec.ts`, `test/e2e/sincronizacion-offline.e2e-spec.ts`.
- Verificación: `scripts/check.sh` + `scripts/test-e2e.sh` (BD arriba).

## Decisiones tomadas durante la implementación
- Módulo nuevo `sincronizacion-offline`; `devices` es precursor de la Épica 8 (solo `codigo` + `api_key_hash` + `ruta_id` + `estado`; `cobrador_id`/`imei`/`whatsapp_number` null hasta Fase 2).
- API key de dispositivo con formato `<codigo>.<secreto>` (secreto hash bcrypt via `PasswordService`); header `x-device-key`; `DeviceApiKeyGuard` adjunta `request.device`.
- `POST /devices` admin-only (JwtAuthGuard + PermisoGuard sin @PermisoRequerido); ingestión y snapshot por API key de dispositivo.
- `sincronizacion_offline.dispositivo_id` se exige (FK no nula) para que la unicidad de dedup sea fiable (el PRD la modela nullable — desviación documentada).
- El DTO valida solo estructura (no `@IsIn`/uuid) para permitir ack por evento: la validación de catálogo/uuid la hace el servicio (un evento inválido no corta el lote).
- Snapshot del día tolera la ausencia de trayecto planificado (`trayectos: null`); reutiliza `ListaClientesDelDiaService`/`RutaOptimizacionService` (exportados desde `RutasModule`) con contexto admin (el dispositivo ya está autenticado y vinculado a su ruta).
- Los eventos se persisten como `sincronizado` (no aplican al dominio; el estado `pendiente` queda para el procesamiento de Fase 2).

## Ambigüedades resueltas con el usuario
- Pregunta: aplicar vs registrar → **solo registrar + dedup + ack** (no aplica al dominio).
- Pregunta: autenticación → **modelo por dispositivo** (registro admin + API key; precursor de Épica 8).
- Pregunta: descarga del día → **incluir snapshot del día** para la APK.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (691 tests, 78 suites).
  - `scripts/test-e2e.sh` → OK (318 tests, 48 suites; incluye `sincronizacion-offline.e2e-spec.ts` 8 tests).
- Archivos modificados:
  - `src/modules/sincronizacion-offline/` (nuevo módulo): `device.entity.ts`, `sincronizacion-offline.entity.ts`, `devices.service.ts` (+spec), `device-api-key.guard.ts` (+spec), `sincronizacion-offline.service.ts` (+spec), `snapshot-dia.service.ts` (+spec), `sincronizacion-offline.controller.ts` (+spec), `sincronizacion-offline.module.ts`, `dto/{registrar-dispositivo,sincronizar-eventos}.dto.ts`.
  - `src/modules/rutas/rutas.module.ts` — exporta `ListaClientesDelDiaService` y `RutaOptimizacionService`.
  - `src/app.module.ts` — registro de `SincronizacionOfflineModule`.
  - `test/e2e/sincronizacion-offline.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/sincronizacion-offline.md` (este archivo).
- Revisión independiente (code-reviewer): realizada, APROBADO sin bloqueantes. Quick-wins aplicados: limpieza e2e por codigo en beforeAll (socio/cobrador) + device por rutaId; `@Min(1)` en `rutaId`; `@ArrayMaxSize(500)` en el lote; 4ª copia de `isUniqueViolation` registrada en backlog.
- Pendientes/seguimiento:
  - Aplicar los eventos al dominio (visitas/pagos/abonos/gastos/promesas/cambios) — Fase 2.
  - Login de cobrador y vinculación IMEI/WhatsApp (Épica 8).
  - Evidencias de gasto en el payload (archivos) — Fase 2.
  - Descarga del día con trayectos: hoy tolera `null` si no hay trayecto planificado.
  - **Limitación conocida (precursor Épica 8)**: el snapshot del día usa contexto admin y NO revalida el estatus de la ruta ni la cascada de bloqueo del socio (HU-05) por request; un dispositivo activo vinculado a una ruta de un socio bloqueado aún puede descargar. El guard sí rechaza dispositivos `revocado`.