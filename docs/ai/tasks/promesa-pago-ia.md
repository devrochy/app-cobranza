# Tarea: Registro de promesa de pago en lenguaje natural (HU-28)

- **Origen:** Roadmap Fase 4 ítem 29 (docs/plan-feature-roadmap.md:58) — HU-28 (docs/APP_REQUIREMENTS.md:88). Tabla `promesas_pago` PRD 4.2:337-338.
- **Estado:** completada
- **Fecha inicio:** 2026-08-20

## Objetivo
Cuando un cliente envía un mensaje con intención `promesa_pago` por el webhook simulado, el asistente parsea la fecha (y opcionalmente el monto) de forma determinista, persiste la promesa vinculada al préstamo de su próxima cuota pendiente y a la conversación, y responde confirmando. Si no puede extraer fecha → pide aclaración (sin persistir, sin derivar).

## Fuera de alcance
- Otras intenciones (negociación HU-29, evaluación de reglas HU-31, derivación HU-32).
- Parseo por LLM (Fase 2) y canal Cloud API real (Fase 2).
- Impacto de la promesa en reportes/liquidaciones (HU-34) y seguimiento de cumplimiento/incumplimiento (se crea en `pendiente`).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad — agregar `conversacion_id` (nullable) a `PromesaPago` (backlog PRD 4.2:338).
- [x] Bloque 2: Nueva intención `promesa_pago` en `src/domain/intencion-ia.ts` (REGLAS_INTENCION). Tests unitarios (4 nuevos).
- [x] Bloque 3: Parser determinista `parsearPromesaPago` en `src/domain/promesa-pago-ia.ts` (fechas relativas/concretas + montos; null si no extrae fecha). Tests unitarios (8).
- [x] Bloque 4: Extender/renombrar el servicio conversacional (`ConsultaSaldoIaService` → `AsistenteIaService`) para despachar `promesa_pago`: resolver cliente, identificar préstamo de la próxima cuota pendiente, persistir `PromesaPago` (`creado_por: "ia"`, `estado: pendiente`, `conversacion_id`), confirmar o pedir aclaración. Tests unitarios (3 nuevos en service + 3 en domain texto).
- [x] Bloque 5: e2e del flujo completo (webhook → promesa persistida + confirmación). e2e (2 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e` (con `--forceExit` por los crons).

## Decisiones tomadas durante la implementación
- Parser determinista acotado (fechas relativas/concretas + montos); si no extrae fecha → pedir aclaración.
- `valor_prometido` = monto explícito si se menciona; si no → valor de la próxima cuota pendiente.
- Préstamo destino = el de la próxima cuota pendiente.
- Se agrega `conversacion_id` (nullable) a `promesas_pago` y la promesa del asistente se vincula a la conversación.
- Sin fecha válida → pedir aclaración (sin persistir, sin derivar).
- Interpretación de fechas: día del mes que ya pasó → mes siguiente; nombre de día ("el viernes") → próximo día con ese nombre.

## Ambigüedades resueltas con el usuario
- Pregunta: alcance del parseo NL → **parser determinista acotado**.
- Pregunta: monto de la promesa → **monto explícito o cuota pendiente**.
- Pregunta: préstamo destino → **préstamo de la próxima cuota**.
- Pregunta: conversacion_id → **agregar ahora**.
- Pregunta: sin fecha parseable → **pedir aclaración**.

## Resultado final
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (531 tests, 64 suites).
  - `npm run test:e2e -- --forceExit` → 40 suites / 268 tests OK (incluye `promesa-pago-ia.e2e-spec.ts`, 2 tests).
- Archivos modificados:
  - `src/modules/cartera/promesa-pago.entity.ts` — agregado `conversacion_id` (nullable, FK `conversaciones_ia`).
  - `src/domain/intencion-ia.ts` (+spec) — nueva intención `promesa_pago`.
  - `src/domain/promesa-pago-ia.ts` (+spec) — `parsearPromesaPago` (fechas relativas/concretas + montos).
  - `src/domain/consulta-saldo-ia.ts` (+spec) — `construirTextoConfirmacionPromesa`, `construirTextoPedirFechaPromesa`.
  - `src/modules/cartera/consulta-saldo-ia.service.ts` → **renombrado** a `asistente-ia.service.ts` (`AsistenteIaService`) + despacho `promesa_pago` (+spec renombrada y ampliada).
  - `src/modules/cartera/whatsapp-simulado.controller.ts` — inyecta `AsistenteIaService`.
  - `src/modules/cartera/cartera.module.ts` — registro de `AsistenteIaService`.
  - `test/e2e/promesa-pago-ia.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/promesa-pago-ia.md` (este archivo).
- Decisiones de implementación:
  - `parsearPromesaPago` es determinista (sin LLM); si no extrae fecha → pedir aclaración (`promesa_pago_clarificacion`).
  - `valor_prometido` = monto explícito si se menciona; si no → valor de la próxima cuota pendiente.
  - Préstamo destino = el de la próxima cuota pendiente (helper `computarProximaCuota`).
  - La promesa del asistente se persiste con `creado_por: "ia"`, `estado: pendiente`, `conversacion_id` de la conversación.
  - Refactor: `ConsultaSaldoIaService` → `AsistenteIaService` (servicio conversacional general, renombrado vía `git mv` preservando historial); los tests existentes de HU-27 se conservaron y pasan.
- Revisión independiente (code-reviewer, 2026-08-20): el subagente `code-reviewer` quedó atrapado en un *doom loop* sin emitir veredicto (AGENTS.md §9). Verificación independiente del punto crítico que perseguía: el refactor de renombrado `ConsultaSaldoIaService` → `AsistenteIaService` NO dejó residuos (grep de `ConsultaSaldoIaService`/`consulta-saldo-ia.service` en `src/` y `test/` → 0 matches), y `git status` muestra el renombrado limpio (R). Toda la suite pasó: lint + typecheck + 531 unit + 268 e2e.
- Pendientes/seguimiento:
  - Otras intenciones (HU-29 negociación, HU-31 evaluación, HU-32 derivación) — extienden `REGLAS_INTENCION` y el despacho.
  - Efecto de la promesa en reportes/liquidaciones (HU-34) y seguimiento de cumplimiento/incumplimiento (estado `cumplida/incumplida`).
  - Parseo por LLM real (PRD 3.3) y canal Cloud API — Fase 2.
