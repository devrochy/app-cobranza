# Tarea: Cobro mensual a socios (HU-60)

- **Origen:** Roadmap Fase 5 ítem 35 (docs/plan-feature-roadmap.md:67) — HU-60 (docs/APP_REQUIREMENTS.md:125). Tablas `cobros_socio`/`conversaciones_socio`/`mensajes_socio`/`links_pago` PRD 4.2:346-356; `rutas.costo_cobro` PRD 4.2:273; mock de pago PRD 6.4:419-423.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-26

## Objetivo
Que el Administrador gestione el cobro mensual a cada Socio: costo base por ruta (`rutas.costo_cobro`), generación del cobro con vencimiento anclado al día de alta del socio, cálculo = suma de costo_cobro de rutas activas en la moneda del socio, registro de pago con historial y notificaciones antes/durante/después vía WhatsApp simulada.

## Fuera de alcance
- Proveedores de pago reales (PRD 6.4; solo mock `links_pago`).
- HU-61 auto-bloqueo por mora (ítem 36) — solo se deja el gancho `estado=pagado` en `registrarPago`.
- HU-63 conversaciones Admin↔Socio (chat/UI/wa.me, ítem 37) — aquí solo entidades + notificaciones automáticas.
- Vista del socio de sus propios cobros (HU-60 es admin-only).
- Consumo de `dias_tolerancia_cobro` (HU-61).

## Bloques (checklist TDD)
- [x] Bloque 1: `rutas.costo_cobro` obligatorio: entidad (numeric, default 0 para filas existentes), `CreateRutaDto` (obligatorio, > 0), `RutasService.create`/`toPublic`; actualizar fixtures e2e de rutas existentes.
  - Test(s): `src/modules/rutas/rutas.service.spec.ts`, `src/modules/rutas/rutas.controller.spec.ts`, `test/e2e/rutas.e2e-spec.ts`.
- [x] Bloque 2: Entidades nuevas `CobroSocio`, `LinkPago`, `ConversacionSocio`, `MensajeSocio` (PRD 4.2:346-356) + `socios.dias_anticipacion_cobro` (int, default 3) y extensión del PATCH de configuración (HU-62).
  - Test(s): `src/modules/socios/socios.service.spec.ts`, e2e socios config.
- [x] Bloque 3: `CobrosSocioService`: `calcularCobro` (suma de rutas activas), `generarCobrosDelDia` (job, idempotente por socio+periodo, día ancla con clamp al último día, primer cobro en siguiente día ancla), `registrarPago` (montoPagado/metodoPago/fechaPago/registradoPor → pagado), `marcarVencidos`, `listar/obtener`.
  - Test(s): `src/modules/cobros-socio/cobros-socio.service.spec.ts`, `cobros-socio-job.spec.ts`.
- [x] Bloque 4: `NotificacionesSocioService`: recordatorio `dias_anticipacion_cobro` antes, aviso el día, confirmación al pagar, alerta al vencer; persiste en `mensajes_socio` (tipo `notificacion_cobro`) con dedup por día, vía `WHATSAPP_GATEWAY`.
  - Test(s): `src/modules/cobros-socio/notificaciones-socio.service.spec.ts`.
- [x] Bloque 5: Controller admin-only: `GET /cobros-socio`, `GET /cobros-socio/:id`, `POST /cobros-socio/:id/pago`, `POST /cobros-socio/generar` + e2e.
  - Test(s): `src/modules/cobros-socio/cobros-socio.controller.spec.ts`, `test/e2e/cobros-socio.e2e-spec.ts`.
- Verificación: `scripts/check.sh` + `scripts/test-e2e.sh` (BD arriba).

## Decisiones tomadas durante la implementación
- `rutas.costo_cobro`: obligatorio en `CreateRutaDto` (>= 0), columna numeric default 0 para filas existentes; se actualizaron los payloads POST /rutas de los 27 e2e existentes (script mecánico preservando indentación) + 2 casos de validación nuevos en rutas.e2e-spec.
- `cobros_socio.periodo` = "YYYY-MM"; `fechaVencimiento` = día ancla (día del `createdAt` del socio) clampeado al último día del mes (helper `cobro-fecha.ts` con `addDays`, `calcularFechaVencimiento`, `esDiaDeCobro`, `diaAnclaDe`).
- `registrado_por` en `cobros_socio` = int (id del admin), siguiendo el patrón de `pagos.registradoPor`.
- `links_pago` con FK `cobro_socio_id` (no se duplica `link_pago_id` en `cobros_socio`, aunque el PRD lista ambos); relación inversa `CobroSocio.linkPago` para el detalle.
- **Desviación del plan**: las notificaciones al socio NO pasan por `WHATSAPP_GATEWAY`. El simulador de WhatsApp persiste en `mensajes_ia` (conversaciones de clientes); el canal del socio en el MVP local es la persistencia directa en `mensajes_socio` (espejo del simulador). Se agrega columna `subtipo` (recordatorio/aviso_dia/confirmacion_pago/alerta_vencido) a `mensajes_socio` para deduplicación por día (el PRD solo define `tipo` notificacion_cobro/manual). Integración real con Cloud API en Fase 2.
- `@RelationId` no es consultable en `where` de TypeORM: se filtra por path de relación (`socio: { id }`), no por `socioId`.
- Controller admin-only vía `JwtAuthGuard`+`PermisoGuard` sin `@PermisoRequerido` (solo rol admin, socio → 403). `POST /:id/pago` dispara además `confirmarPago` (notificación "después").
- Job cron diario 02:30 UTC: `generarCobrosDelDia` + `marcarVencidos` + `ejecutarCiclo` (recordatorios/aviso/alerta). Misma limitación de zona UTC que el job de mora.
- `CobrosSocioModule` importa `JwtModule` (guard). NO importa `CarteraModule` (no se usa: las notificaciones al socio persisten directo en `mensajes_socio`).
- Quick-wins del code-reviewer aplicados:
  - **Constraint única** `UQ_cobro_socio_periodo (socio_id, periodo)` + manejo de violación 23505 en `crearCobroSiNoExiste` (idempotencia robusta ante concurrencia job/manual).
  - **Generación N días antes del vencimiento**: el job genera el cobro `dias_anticipacion_cobro` días antes de su vencimiento (no el mismo día ancla) para que el recordatorio "antes" tenga un cobro que notificar. Desviación del plan aprobado (que decía "día ancla") documentada aquí; con `dias=0` genera el día del vencimiento. Helper `fechaGeneracionCobro`.
  - **`montoPagado @Min(1)`** en `RegistrarPagoCobroDto` (un pago de 0 no marca el cobro pagado).
  - Import muerto de `CarteraModule` eliminado.
- Preguntas de negocio del code-reviewer pendientes de resolver (no bloqueantes):
  - ¿Pago parcial debe dejar el cobro en estado `parcial` en lugar de `pagado` (para no habilitar prematuramente al socio vía HU-61)? Hoy `registrarPago` acepta `montoPagado != montoCalculado` y marca `pagado`.
  - ¿La alerta de vencido debe repetirse diariamente hasta el pago (comportamiento actual con dedup diario) o limitarse a una sola notificación?

## Ambigüedades resueltas con el usuario
- Pregunta: fórmula del cobro → **suma de `costo_cobro` de las rutas activas del socio** (PRD 4.2:273).
- Pregunta: configuración de `costo_cobro` → **obligatorio al crear la ruta** (default 0 en BD para filas existentes).
- Pregunta: persistencia de notificaciones → **crear `conversaciones_socio`/`mensajes_socio` ahora** + `NotificacionesSocioService` (HU-63 reutiliza).
- Pregunta: timing del recordatorio → **configurable por socio** (`dias_anticipacion_cobro`).
- Pregunta: bordes de fecha → **clamp al último día del mes + primer cobro al siguiente día ancla**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (645 tests, 74 suites).
  - `scripts/test-e2e.sh` → OK (298 tests, 45 suites; incluye `cobros-socio.e2e-spec.ts` 9 tests y 2 validaciones nuevas de rutas).
- Archivos modificados:
  - `src/modules/rutas/ruta.entity.ts`, `rutas.service.ts` (+spec), `rutas.controller.spec.ts`, `dto/create-ruta.dto.ts` — `costo_cobro`.
  - `src/modules/socios/socio.entity.ts`, `socios.service.ts` (+spec), `dto/actualizar-configuracion-socio.dto.ts` — `dias_anticipacion_cobro`.
  - `src/modules/cobros-socio/` (nuevo módulo): `cobro-socio.entity.ts`, `link-pago.entity.ts`, `conversacion-socio.entity.ts`, `mensaje-socio.entity.ts` (+ `subtipo`), `cobro-fecha.ts` (+spec), `cobros-socio.service.ts` (+spec), `cobros-socio-job.service.ts` (+spec), `notificaciones-socio.service.ts` (+spec), `cobros-socio.controller.ts` (+spec), `cobros-socio.module.ts`, `dto/{listar-cobros,registrar-pago-cobro,generar-cobro-socio}.dto.ts`.
  - `src/app.module.ts` — registro de `CobrosSocioModule`.
  - `test/e2e/cobros-socio.e2e-spec.ts` (nuevo) + payloads `costoCobro` en 27 e2e de rutas + 2 casos de validación en `rutas.e2e-spec.ts`.
  - `docs/ai/tasks/cobros-socio.md` (este archivo).
- Revisión independiente (code-reviewer): realizada (ver abajo).
- Pendientes/seguimiento:
  - HU-61 (ítem 36): consumir `estado=pagado`/`fecha_pago` para auto-habilitación; `dias_tolerancia_cobro` para auto-bloqueo.
  - HU-63 (ítem 37): sección conversaciones Admin↔Socio sobre `conversaciones_socio`/`mensajes_socio`.
  - Generación de cobros por periodo en la práctica de la jornada (si el job falla el día ancla, el cobro de ese periodo no se genera retroactivamente; `POST /cobros-socio/generar` lo cubre manualmente).
  - Alerta de vencido se dispara en el ciclo del job (cada día tras marcarse vencido) con dedup diario.