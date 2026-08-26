# Tarea: Conversaciones Admin↔Socio: historial unificado, chat por simulador y enlace wa.me (HU-63)

- **Origen:** Roadmap Fase 5 ítem 37 (docs/plan-feature-roadmap.md:69) — HU-63 (docs/APP_REQUIREMENTS.md:126), espejo de HU-53 (historial-chat-cliente.md:3). Entidades `conversaciones_socio`/`mensajes_socio` PRD 4.2:349-353; historial unificado PRD 4.3:368.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-26

## Objetivo
Que el Administrador consulte la sección de conversaciones con cada Socio (historial unificado con notificaciones de cobro + mensajes manuales + enlace wa.me), envíe mensajes manuales, y que cada Socio vea su propia conversación y responda (chat por simulador sobre las entidades de HU-60).

## Fuera de alcance
- Chat en tiempo real (WebSockets, Fase 2).
- Webhook real de WhatsApp Cloud API (Fase 2).
- Notificaciones push de mensajes recibidos.
- Envío de reporte/estado de cuenta del socio por WhatsApp.

## Bloques (checklist TDD)
- [x] Bloque 1: `ConversacionSocioChatService` en `cobros-socio`: `listarConversaciones` (admin), `obtenerHistorial(socioId, requester)`, `enviarMensaje(socioId, contenido, requester)`; acceso self-service (admin → cualquiera, socio → solo su propio, cobrador → 403); `NotificacionesSocioService.obtenerConversacion` hecho público.
  - Test(s): `src/modules/cobros-socio/conversacion-socio-chat.service.spec.ts`.
- [x] Bloque 2: Controller `@Controller("conversaciones-socio")`: `GET /conversaciones-socio` (admin-only), `GET /conversaciones-socio/:socioId` (historial), `POST /conversaciones-socio/:socioId/mensajes` + DTO `EnviarMensajeSocioDto` + e2e.
  - Test(s): `src/modules/cobros-socio/conversaciones-socio.controller.spec.ts`, `test/e2e/conversaciones-socio.e2e-spec.ts`.
- Verificación: `scripts/check.sh` + `scripts/test-e2e.sh` (BD arriba).

## Decisiones tomadas durante la implementación
- `ConversacionSocioChatService` en el módulo `cobros-socio`; prefix `conversaciones-socio` (evita ambigüedad con `GET /cobros-socio/:id`, que es id de cobro).
- Acceso: el listado usa `JwtAuthGuard + PermisoGuard` (sin `@PermisoRequerido` → admin-only); el historial y el envío usan `JwtAuthGuard` y la validación de rol/self-service se hace en el servicio (`cobrador` → 403; `socio` con `sub != socioId` → 403).
- El emisor del mensaje se deduce del rol: admin → `admin`, socio → `socio`; tipo `manual`, subtipo null.
- `NotificacionesSocioService.obtenerConversacion` pasó de privado a público (reutilización, patrón HU-53).
- wa.me generado desde `socios.telefono` con `generarLinkWaMe`.
- El historial ya incluye las notificaciones de cobro automáticas (HU-60) sin cambios de schema.

## Ambigüedades resueltas con el usuario
- Pregunta: acceso del socio → **self-service sin permiso** (el socio ve/envía en su propia conversación; validación de rol/self-service en el servicio, sin `@PermisoRequerido`).
- Pregunta: listado → **incluir `GET /conversaciones-socio`** (admin: socios + waMe + último mensaje).
- Pregunta: canal del socio → **sesión autenticada** (POST mensaje, emisor `socio`; webhook real en Fase 2).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (658 tests, 76 suites).
  - `scripts/test-e2e.sh` → OK (307 tests, 46 suites; incluye `conversaciones-socio.e2e-spec.ts` 9 tests).
- Archivos modificados:
  - `src/modules/cobros-socio/conversacion-socio-chat.service.ts` (+spec) — `listarConversaciones`, `obtenerHistorial`, `enviarMensaje`.
  - `src/modules/cobros-socio/notificaciones-socio.service.ts` — `obtenerConversacion` público.
  - `src/modules/cobros-socio/conversaciones-socio.controller.ts` (+spec) — endpoints de conversación.
  - `src/modules/cobros-socio/dto/enviar-mensaje-socio.dto.ts` (nuevo) — con `@Matches(/\S/)` y `@MaxLength(2000)`.
  - `src/modules/cobros-socio/cobros-socio.module.ts` — service + controller.
  - `test/e2e/conversaciones-socio.e2e-spec.ts` (nuevo, 9 tests).
  - `docs/ai/tasks/conversaciones-socio.md` (este archivo).
- Revisión independiente (code-reviewer): realizada, APROBADO sin bloqueantes. Quick-wins aplicados: `EnviarMensajeSocioDto` valida solo-espacios (`@Matches(/\S/)`) y limita a 2000 chars; `ACCESO_DENEGADO` importado de `src/common/ownership.ts` (fuente única).
- Pendientes/seguimiento:
  - Chat en tiempo real (WebSockets, Fase 2).
  - Webhook real de WhatsApp Cloud API (Fase 2).
  - Notificaciones push de mensajes recibidos.
  - `listarConversaciones` con N+1 (2N+1 queries) — aceptable para MVP; optimizable con leftJoin.
  - Sin paginación en el listado — con muchos socios crecerá la respuesta.