# Tarea: Detección y derivación a agente humano de casos complejos (HU-32)

- **Origen:** Roadmap Fase 4 ítem 32 (docs/plan-feature-roadmap.md:61) — HU-32 (docs/APP_REQUIREMENTS.md:92). PRD 4.2:332 (`conversaciones_ia.estado/motivo_derivacion/agente_asignado_id`). Incluye el wiring diferido de `umbral_saldo_autonomo` (HU-31).
- **Estado:** completada
- **Fecha inicio:** 2026-08-21

## Objetivo
Cuando un mensaje del cliente señala un caso que requiere atención humana (solicitud de agente, disputa, queja, lenguaje agresivo, fraude), el asistente marca la conversación como `derivada` (con `motivo_derivacion`) y responde que un agente lo atenderá. Además, si el saldo del cliente supera `umbral_saldo_autonomo`, la negociación se deriva en vez de confirmarse.

## Fuera de alcance
- Panel/endpoint para que el agente humano vea y tome los casos derivados (HU-33/HU-24, panel).
- Detección por LLM real (Fase 2).
- Detener las notificaciones automáticas en conversaciones derivadas (decisión: seguir respondiendo; se documenta como posible mejora).

## Bloques (checklist TDD)
- [x] Bloque 1: Función pura `detectarDerivacion` en `src/domain/derivacion-ia.ts` (5 casos: solicitud_agente, disputa_monto, queja, lenguaje_agresivo, fraude; por palabras clave). Tests unitarios (9).
- [x] Bloque 2: Función de texto `construirTextoDerivacion` en `consulta-saldo-ia.ts`. Tests unitarios (1).
- [x] Bloque 3: Derivación en `AsistenteIaService.procesarMensaje` (marcar estado derivada + motivo + agente null, responder) + ajuste de `obtenerConversacion` para reutilizar la conversación más reciente (activa o derivada). Tests unitarios (1 nuevo en service).
- [x] Bloque 4: Wiring del `umbral_saldo_autonomo` en `registrarPromesa` (si saldo > umbral → derivar en vez de confirmar). Tests unitarios (1 nuevo en service).
- [x] Bloque 5: e2e (derivación por mensaje; derivación por umbral en negociación). e2e (2 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e` (con `--forceExit` por los crons).

## Decisiones tomadas durante la implementación
- Detección determinista por palabras clave cubriendo los 5 casos.
- Derivación → `estado: derivada`, `motivo_derivacion` seteado, `agente_asignado_id: null` (cola de casos para que el agente lo tome).
- Tras derivar, el asistente sigue respondiendo (decisión del usuario); se reutiliza la conversación más reciente (activa o derivada) para no deshacer la derivación creando una activa nueva.
- `umbral_saldo_autonomo` se evalúa en la negociación: si se supera, se deriva en vez de confirmar.

## Ambigüedades resueltas con el usuario
- Pregunta: alcance de detección → **cubre los 5 casos**.
- Pregunta: asignación del agente → **estado derivada + motivo, agente sin asignar** (null).
- Pregunta: comportamiento post-derivación → **seguir respondiendo** (se reutiliza la conversación derivada).
- Pregunta: wiring umbral_saldo → **sí, derivar si el saldo supera el umbral**.

## Resultado final
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (576 tests, 67 suites).
  - `npm run test:e2e -- --forceExit` → 43 suites / 274 tests OK (incluye `derivacion-agente-humano.e2e-spec.ts`, 2 tests).
- Archivos modificados:
  - `src/domain/derivacion-ia.ts` (+spec) — `detectarDerivacion` (5 casos por palabras clave).
  - `src/domain/consulta-saldo-ia.ts` (+spec) — `construirTextoDerivacion`.
  - `src/modules/cartera/asistente-ia.service.ts` (+spec) — branch de derivación en `procesarMensaje`, helper `marcarDerivada`, wiring de `umbral_saldo_autonomo` en `registrarPromesa`.
  - `src/modules/cartera/notificaciones.service.ts` — `obtenerConversacion` reutiliza la conversación más reciente (activa o derivada).
  - `test/e2e/derivacion-agente-humano.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/derivacion-agente-humano.md` (este archivo).
- Decisiones de implementación:
  - Derivación → `estado: derivada`, `motivo_derivacion` (catálogo o `saldo_supera_umbral`), `agente_asignado_id: null`.
  - El asistente responde `construirTextoDerivacion` (intención `derivacion`) y sigue respondiendo a mensajes posteriores (decisión del usuario); `obtenerConversacion` reutiliza la conversación derivada para no crear una activa nueva.
  - `umbral_saldo_autonomo`: si el saldo del cliente supera el umbral en una negociación, se deriva en vez de confirmar.
- Revisión independiente (code-reviewer, 2026-08-21): inicialmente **NO APROBADO** → bloqueante corregido y re-verificado, luego **APROBADO CON OBSERVACIONES** (sin bloqueantes). Bloqueante atendido: la clave `"rat"` en `lenguaje_agresivo` producía falsos positivos ("tratar", "contrato", "gratis", "tratamiento") → se eliminó `rat`/`rata`/`ratas` y se usaron insultos inequívocos (`malnacido`, `hijo de puta`, `mentiroso`, `ladron`, etc.) + tests de regresión de palabras benignas. Además se normalizan las claves (acentos) en el matcheo (las claves con acento como "atención"/"imbécil" ahora sí matchean). Observaciones atendidas: `obtenerConversacion` filtra a `estado In(["activa","derivada"])` (excluye `resuelta`, alineado con la intención documentada). Documentadas sin cambio: redundancia de `obtenerConversacion` en `registrarPromesa` (nit), duplicación de `normalizar` entre `derivacion-ia` e `intencion-ia` (nit), cohesión de `consulta-saldo-ia.ts` alojando textos de derivación (nit), cobertura unitaria de `obtenerConversacion` solo vía e2e (aceptable).
- Pendientes/seguimiento:
  - Panel/endpoint para que el agente humano vea y tome los casos derivados (HU-33/HU-24).
  - Detección por LLM real (Fase 2).
  - Considerar detener las notificaciones automáticas en conversaciones derivadas (decisión actual: seguir respondiendo).