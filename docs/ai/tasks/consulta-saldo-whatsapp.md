# Tarea: Consulta de saldo y próxima cuota por WhatsApp (HU-27)

- **Origen:** Roadmap Fase 4 ítem 28 (docs/plan-feature-roadmap.md:57) — HU-27 (docs/APP_REQUIREMENTS.md:87).
- **Estado:** completada
- **Fecha inicio:** 2026-08-20

## Objetivo
Cuando un cliente envía un mensaje por el webhook simulado de WhatsApp, el sistema detecta la intención `consulta_saldo` (determinista, sin LLM) y responde automáticamente con el saldo agregado de sus préstamos activos, la próxima cuota y su fecha de vencimiento. El mensaje de respuesta se persiste en la conversación (emisor `ia`, intención `consulta_saldo`).

## Fuera de alcance
- Otras intenciones conversacionales (promesa de pago HU-28, negociación HU-29, derivación HU-32, evaluación de reglas HU-31).
- Canal WhatsApp Cloud API real (Fase 2) y clasificación LLM (PRD 3.3, Fase 2).
- Historial unificado adicional (HU-53 ya lo cubre).

## Bloques (checklist TDD)
- [x] Bloque 1: Función pura `detectarIntencion` por reglas/palabras clave en `src/domain/intencion-ia.ts` (reconoce `consulta_saldo`, contrato extensible, intención desconocida). Tests unitarios (9).
- [x] Bloque 2: Servicio conversacional (`ConsultaSaldoIaService`) — resuelve cliente (conversación prioritario, teléfono fallback), calcula saldo agregado + próxima cuota + vencimiento (reutiliza `construirEstadoCuentaPrestamo`), genera texto (`construirTextoConsultaSaldo`/`construirTextoFallback`) y envía vía gateway (emisor `ia`); fallback genérico para intención desconocida. Tests unitarios (4 service + 4 domain texto).
- [x] Bloque 3: Wiring del webhook `POST /whatsapp/simulado/recibir` — ampliar DTO con `telefono` opcional y, tras persistir el mensaje del cliente, invocar el servicio para auto-responder. e2e (3 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e` (con `--forceExit` por los crons).

## Decisiones tomadas durante la implementación
- Detección de intención por reglas/palabras clave (sin LLM, MVP Fase 1).
- Respuesta = saldo agregado de todos los préstamos vigentes + próxima cuota (más próxima no pagada) + fecha de vencimiento.
- Intención desconocida → respuesta genérica de fallback (sin derivación; HU-32 posterior).
- Resolución del cliente: por conversación (`conversacionId` → `conversaciones_ia.cliente_id`) prioritario, fallback por teléfono entrante.
- Reutiliza `construirEstadoCuentaPrestamo` (HU-54).

## Ambigüedades resueltas con el usuario
- Pregunta: detección de intención → **módulo por reglas/palabras clave** (extensible).
- Pregunta: contenido de respuesta → **agregado de todos los préstamos activos**.
- Pregunta: mensaje no reconocido → **respuesta genérica de fallback**.
- Pregunta: identificación del cliente → **por conversación y también por teléfono**.

## Resultado final
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (513 tests, 63 suites).
  - `npm run test:e2e -- --forceExit` → 39 suites / 266 tests OK (incluye `consulta-saldo-whatsapp.e2e-spec.ts`, 3 tests).
- Archivos modificados:
  - `src/domain/intencion-ia.ts` (+spec) — `detectarIntencion` por palabras clave (catálogo extensible).
  - `src/domain/consulta-saldo-ia.ts` (+spec) — `construirTextoConsultaSaldo`, `construirTextoFallback`.
  - `src/modules/cartera/consulta-saldo-ia.service.ts` (+spec) — `procesarMensaje` (resuelve cliente, calcula saldo, responde).
  - `src/modules/cartera/whatsapp-simulado.controller.ts` — DTO con `telefono` opcional + wiring de `procesarMensaje`.
  - `src/modules/cartera/cartera.module.ts` — registro de `ConsultaSaldoIaService`.
  - `test/e2e/consulta-saldo-whatsapp.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/consulta-saldo-whatsapp.md` (este archivo).
- Decisiones de implementación:
  - Detección de intención determinista por palabras clave (MVP Fase 1, sin LLM).
  - Respuesta agregada de todos los préstamos vigentes + próxima cuota (más próxima no pagada con saldo > 0) + fecha de vencimiento.
  - Intención desconocida → fallback genérico (sin derivar; HU-32 posterior).
  - Resolución del cliente: conversación (`conversacionId` → `cliente_id`) prioritario, fallback por `telefono_whatsapp`.
  - Reutiliza `construirEstadoCuentaPrestamo` (HU-54); moneda desde la ruta del cliente.
  - El webhook responde sin romper la recepción (try/catch no bloqueante).
- Revisión independiente (code-reviewer, 2026-08-20): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) riesgo de privacidad por teléfono compartido → `resolverCliente` ahora usa `find` con `take: 2` y, si hay varios clientes con el mismo teléfono, NO responde (log de advertencia) para evitar filtrar datos de otro cliente + test; (b) test de agregación multi-préstamo agregado (saldo agregado + próxima cuota más próxima entre préstamos); (c) test del caso "conversación existe pero cliente no" agregado. Documentadas sin cambio: sin spec unitario del controller (el wiring se cubre por e2e), caso borde de ruta inexistente (moneda vacía), nit de línea duplicada en spec de intención.
- Pendientes/seguimiento:
  - Otras intenciones conversacionales (HU-28 promesa, HU-29 negociación, HU-31 evaluación, HU-32 derivación) — extienden el catálogo `REGLAS_INTENCION`.
  - Clasificación LLM real (PRD 3.3) — Fase 2.
  - Canal WhatsApp Cloud API real — Fase 2.
  - `telefono_whatsapp` no es único global; al resolver por teléfono se toma el primero que coincida (documentado).
