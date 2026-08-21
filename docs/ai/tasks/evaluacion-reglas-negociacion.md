# Tarea: Evaluación de cada negociación contra las reglas configuradas antes de confirmar (HU-31)

- **Origen:** Roadmap Fase 4 ítem 31 (docs/plan-feature-roadmap.md:60) — HU-31 (docs/APP_REQUIREMENTS.md:91). PRD 3.3 "IA propone, reglas deciden" (líneas 172-174). Consume `reglas_negociacion_ia` (HU-25).
- **Estado:** completada
- **Fecha inicio:** 2026-08-20

## Objetivo
Interponer un motor determinista de evaluación en el flujo de negociación (`AsistenteIaService.registrarPromesa`, HU-29) que valida la propuesta contra `reglas_negociacion_ia` (HU-25) ANTES de persistir el acuerdo. Aprobada → persiste y confirma; rechazada → no persiste y responde "límite excedido".

## Fuera de alcance
- Evaluación de `umbral_saldo_autonomo` y derivación a humano (HU-32).
- Ejecución de reprogramación real de cuotas (HU-34 / feature transaccional).
- Auditoría imborrable de acuerdos (HU-34).

## Bloques (checklist TDD)
- [x] Bloque 1: Función pura `evaluarNegociacion` en `src/domain/evaluacion-negociacion-ia.ts` — mapea reglas a tipos (min_abono→abono_parcial, max_dias_prorroga→fecha prometida vs vencimiento, max_reprogramaciones→refinanciacion); reglas con valor 0 = no aplican; devuelve `{ aprobado, motivos }`. Tests unitarios (10).
- [x] Bloque 2: Función de texto `construirTextoNegociacionRechazada(motivos)` en `consulta-saldo-ia.ts`. Tests unitarios (2).
- [x] Bloque 3: Wiring en `AsistenteIaService.registrarPromesa` — inyectar `ReglasNegociacionIaService` (importar `ReglasNegociacionIaModule` en cartera.module), contar reprogramaciones del cliente (`promesas_pago` tipo refinanciacion), armar propuesta, evaluar; persistir si aprobada, responder rechazo si no. Tests unitarios (1 nuevo en service).
- [x] Bloque 4: e2e (negociación aprobada persiste; excedida no persiste + mensaje de rechazo). e2e (2 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e` (con `--forceExit` por los crons).

## Decisiones tomadas durante la implementación
- Cada regla se aplica a su tipo: `min_abono_aceptable_pct` → `abono_parcial`; `max_dias_prorroga` → cualquier acuerdo con fecha prometida (días desde el vencimiento de la cuota); `max_reprogramaciones_por_cliente` → `refinanciacion`.
- `max_dias_prorroga` se mide desde el vencimiento de la cuota.
- Rechazo → no persistir y responder "límite excedido" (sin derivar; HU-32 posterior).
- `umbral_saldo_autonomo` → NO se evalúa en esta iteración (pendiente HU-32).
- Reglas con valor 0 (default) = no configuradas = no se aplican (aprueba).

## Ambigüedades resueltas con el usuario
- Pregunta: mapeo de reglas → **cada regla a su tipo**.
- Pregunta: referencia max_dias_prorroga → **desde el vencimiento de la cuota**.
- Pregunta: qué pasa al rechazar → **no persistir y responder límite excedido**.
- Pregunta: umbral_saldo_autonomo → **ignorar en esta iteración** (difiere a HU-32).

## Resultado final
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (562 tests, 66 suites).
  - `npm run test:e2e -- --forceExit` → 42 suites / 272 tests OK (incluye `evaluacion-reglas-negociacion.e2e-spec.ts`, 2 tests).
- Archivos modificados:
  - `src/domain/evaluacion-negociacion-ia.ts` (+spec) — `evaluarNegociacion` (motor determinista de reglas).
  - `src/domain/consulta-saldo-ia.ts` (+spec) — `construirTextoNegociacionRechazada`.
  - `src/modules/cartera/asistente-ia.service.ts` (+spec) — evaluación en `registrarPromesa` antes de persistir; inyección de `ReglasNegociacionIaService`; conteo de reprogramaciones; rechazo sin persistir.
  - `src/modules/cartera/cartera.module.ts` — import de `ReglasNegociacionIaModule`.
  - `test/e2e/evaluacion-reglas-negociacion.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/evaluacion-reglas-negociacion.md` (este archivo).
- Decisiones de implementación:
  - Motor puro `evaluarNegociacion` (sin DB): reglas con valor 0 = no configuradas = no aplican (compatibilidad con el flujo previo de HU-29).
  - `min_abono_aceptable_pct` → `abono_parcial`; `max_dias_prorroga` → cualquier acuerdo con fecha (desde el vencimiento de la cuota); `max_reprogramaciones_por_cliente` → `refinanciacion` (cuenta `promesas_pago` tipo refinanciacion del cliente).
  - Rechazo → NO persiste la promesa; responde `construirTextoNegociacionRechazada` con intención `promesa_pago_rechazada`.
  - `umbral_saldo_autonomo` NO se evalúa (difiere a HU-32).
- Revisión independiente (code-reviewer, 2026-08-20): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) tests de boundary en el motor — `max_dias_prorroga` con días == máximo (aprueba) y `min_abono_aceptable_pct` con valor == mínimo (aprueba); (b) verificación del filtro del conteo de reprogramaciones en el spec del servicio. Documentadas sin cambio: el conteo de reprogramaciones cuenta todas las promesas `tipo: refinanciacion` del cliente sin filtrar por estado (decisión razonable, se registra); el e2e solo ejercita `min_abono_aceptable_pct` (las otras dos reglas quedan cubiertas por unit tests del motor, aceptable).
- Pendientes/seguimiento:
  - Evaluación de `umbral_saldo_autonomo` y derivación a humano (HU-32).
  - Ejecución de reprogramación real de cuotas (HU-34 / feature transaccional).
  - Auditoría imborrable de acuerdos (HU-34).