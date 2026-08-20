# Tarea: Historial unificado de conversación con el cliente, chat por simulador y enlace wa.me (HU-53)

- **Origen:** Roadmap Fase 4 ítem 25 (docs/plan-feature-roadmap.md:54) — HU-53 (docs/APP_REQUIREMENTS.md:96), amplía HU-19/HU-33.
- **Estado:** completada
- **Fecha inicio:** 2026-08-20

## Objetivo
Historial unificado de conversación con el cliente (mensajes IA, notificaciones, mensajes manuales de agentes), chat por simulador (enviar mensaje del agente) y enlace wa.me, sobre la infraestructura del ítem 23.

## Fuera de alcance
- Asistente IA conversacional (orquestación LLM) — Épica 6 (HU-27 a HU-34).
- Historial Admin↔Socio (HU-63, Fase 5).
- Chat en tiempo real (WebSockets) — el chat es request/response vía simulador (Fase 2).
- Tarjeta/estado de cuenta y envío del reporte por WhatsApp (HU-54, ítem 26).

## Decisiones tomadas durante la implementación
- Base de rama: esperar merge de la PR #45 (HU-52) — ya mergeado (6902fe4).
- Alcance: historial + enviar mensaje del agente + wa.me.
- Enlace wa.me generado en el backend desde `clientes.telefono_whatsapp`.
- Permiso: `ver_reportes` (Admin/Socio; cobrador modelado para cuando tenga login).

## Bloques (checklist TDD)
- [x] Bloque 0: Función pura `generarLinkWaMe` en `src/domain/wa-me.ts`. 4 tests.
- [x] Bloque 1: `ConversacionChatService` — `obtenerHistorial` (mensajes_ia ordenados + wa.me) y `enviarMensajeAgente` (emisor agente via gateway). Reutiliza `NotificacionesService.obtenerConversacion` (hecho público, anti-redundancia). 5 tests unitarios.
- [x] Bloque 2: Endpoints `GET .../clientes/:clienteId/conversacion` y `POST .../conversacion/mensajes` (ver_reportes) + DTO `EnviarMensajeDto`. 5 e2e.
- Verificación: `scripts/check.sh` + e2e (con `--forceExit` por los crons de @nestjs/schedule).

## Ambigüedades resueltas con el usuario
- Pregunta: base → **esperar merge de PR #45** (ya mergeado).
- Pregunta: alcance → **historial + enviar mensaje agente + wa.me**.
- Pregunta: wa.me → **generar en el backend**.
- Pregunta: permiso → **ver_reportes**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - e2e `historial-chat-cliente.e2e-spec.ts` → 5 tests OK (con `--forceExit` por los crons).
- Archivos modificados:
  - `src/domain/wa-me.ts` (+spec) — `generarLinkWaMe`.
  - `src/modules/cartera/conversacion-chat.service.ts` (+spec) — `obtenerHistorial`, `enviarMensajeAgente`.
  - `src/modules/cartera/notificaciones.service.ts` — `obtenerConversacion` hecho público (reutilizado).
  - `src/modules/cartera/dto/enviar-mensaje.dto.ts` (nuevo).
  - `src/modules/cartera/cartera.controller.ts` (+spec) — `GET .../conversacion` y `POST .../conversacion/mensajes` gated `ver_reportes`.
  - `src/modules/cartera/cartera.module.ts` — registro de `ConversacionChatService`.
  - `test/e2e/historial-chat-cliente.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/historial-chat-cliente.md` (este archivo).
- Decisiones de implementación:
  - `generarLinkWaMe` normaliza el teléfono (quita `+`, espacios, guiones) → `https://wa.me/<num>`.
  - El historial reutiliza `NotificacionesService.obtenerConversacion` (crea la conversación activa si no existe).
  - `enviarMensajeAgente` persiste en `mensajes_ia` con emisor `agente` via gateway.
- Revisión independiente (code-reviewer, 2026-08-20): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) limpieza de `socio-chat-2` en beforeAll/afterAll (evita residuos); (b) e2e de contenido vacío en POST mensaje → 400. Observación documentada sin cambio: el `id ?? 0` en `enviarMensajeAgente` (el gateway simulado siempre devuelve el id real; cast frágil pero funcional); `timestamp` devuelto con `new Date()` vs. el persistido en DB (leve discrepancia).
- Pendientes/seguimiento:
  - Asistente IA conversacional (Épica 6) — esta iteración solo chat manual del agente.
  - Historial Admin↔Socio (HU-63, Fase 5).
  - Chat en tiempo real (WebSockets) — Fase 2.