# Tarea: Negociación de refinanciación o abono parcial por WhatsApp (HU-29)

- **Origen:** Roadmap Fase 4 ítem 30 (docs/plan-feature-roadmap.md:59) — HU-29 (docs/APP_REQUIREMENTS.md:89).
- **Estado:** completada
- **Fecha inicio:** 2026-08-20

## Objetivo
Cuando el cliente solicita una negociación por el webhook simulado, el asistente determina el tipo (abono parcial / refinanciación / promesa), persiste el acuerdo en `promesas_pago` con el `tipo` correspondiente (`creado_por: "ia"`, `conversacion_id`) y responde confirmando. No se ejecuta la reprogramación real de cuotas (diferida a iteración transaccional con HU-31/34).

## Fuera de alcance
- Ejecución de reprogramación real de cuotas (mutación de préstamo/cuotas) — iteración transaccional con HU-31/34.
- Evaluación contra `reglas_negociacion_ia` (HU-31).
- Auditoría imborrable de acuerdos (HU-34) más allá de la persistencia básica.
- Derivación a humano de casos complejos (HU-32).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad — agregar `tipo` a `PromesaPago` (enum `promesa | abono_parcial | refinanciacion`, default `promesa`).
- [x] Bloque 2: Función pura `detectarTipoNegociacion` en `src/domain/negociacion-ia.ts` (abono→abono_parcial, refinanciar/reprogramar/plan de pago→refinanciacion, default→promesa). Tests unitarios (7).
- [x] Bloque 3: Funciones de texto `construirTextoConfirmacionAbonoParcial` y `construirTextoConfirmacionRefinanciacion` (dejan claro que la refinanciación se registra, no se ejecuta). Tests unitarios (2).
- [x] Bloque 4: Extender `AsistenteIaService` para detectar tipo y persistir la promesa/acuerdo con `tipo`. Tests unitarios (2 nuevos; además se amplió `promesa_pago` en `intencion-ia.ts` para incluir refinanciación/reprogramar/plan de pago, con prioridad sobre consulta_saldo, y se reordenaron las reglas).
- [x] Bloque 5: e2e del flujo (abono parcial persistido con tipo; refinanciación persistida con tipo). e2e (2 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e` (con `--forceExit` por los crons).

## Decisiones tomadas durante la implementación
- Se reutiliza la intención `promesa_pago` (no nueva intención top-level); el tipo de negociación se distingue por palabras clave.
- `promesas_pago.tipo` nuevo campo: `promesa | abono_parcial | refinanciacion` (default `promesa` para no romper promesas de visita HU-46).
- Abono parcial: persiste `tipo: abono_parcial` (monto/fecha parseados), no ejecuta pago.
- Refinanciación: persiste `tipo: refinanciacion`, NO muta cuotas (se registra la intención; la reprogramación efectiva es una feature transaccional aparte con HU-31/34). El texto lo deja claro.

## Ambigüedades resueltas con el usuario
- Pregunta: alcance → **interpretar + persistir acuerdo**.
- Pregunta: abono parcial → **confirmar conversacionalmente** (persistir, no ejecutar pago).
- Pregunta: refinanciación → **persistir acuerdo, no ejecutar reprogramación real** (mutación diferida a HU-31/34).
- Pregunta: intención → **reusar `promesa_pago`** + distinguir tipo por palabras clave.
- Pregunta: persistencia → **reusar `promesas_pago` con campo `tipo`**.

## Resultado final
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (547 tests, 65 suites).
  - `npm run test:e2e -- --forceExit` → 41 suites / 270 tests OK (incluye `negociacion-ia.e2e-spec.ts`, 2 tests).
- Archivos modificados:
  - `src/modules/cartera/promesa-pago.entity.ts` — agregado campo `tipo` (enum `promesa | abono_parcial | refinanciacion`, default `promesa`).
  - `src/domain/negociacion-ia.ts` (+spec) — `detectarTipoNegociacion`.
  - `src/domain/consulta-saldo-ia.ts` (+spec) — `construirTextoConfirmacionAbonoParcial`, `construirTextoConfirmacionRefinanciacion`.
  - `src/domain/intencion-ia.ts` (+spec) — `promesa_pago` ampliado con palabras de negociación (refinanciar/reprogramar/plan de pago). Se eliminó la palabra clave suelta `cuota` de `consulta_saldo` (se conserva `proxima cuota`) y se agregó normalización de acentos (NFD), de modo que "reprogramar mis cuotas" se clasifica como `promesa_pago` sin romper "cuánto debo pagar" → `consulta_saldo`.
  - `src/modules/cartera/asistente-ia.service.ts` (+spec) — `registrarPromesa` detecta tipo, persiste `tipo` y elige el texto de confirmación según el tipo.
  - `test/e2e/negociacion-ia.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/negociacion-ia.md` (este archivo).
- Decisiones de implementación:
  - Se reutiliza la intención `promesa_pago`; el tipo de negociación se distingue por `detectarTipoNegociacion`.
  - La refinanciación se persiste como acuerdo (`tipo: refinanciacion`) pero NO muta cuotas; el texto de confirmación lo deja claro.
  - El abono parcial se persiste (`tipo: abono_parcial`) sin ejecutar el pago.
  - `fecha_prometida` sigue siendo obligatoria; para persistir una refinanciación el cliente debe indicar una fecha (si no, se pide aclaración).
- Revisión independiente (code-reviewer, 2026-08-20): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendida la observación principal (regresión por reordenamiento de intenciones): se eliminó la palabra suelta `cuota` de `consulta_saldo` (se conserva `proxima cuota`), se agregó normalización de acentos (NFD) y tests de regresión ("cuánto debo pagar" → consulta_saldo; "reprogramar mis cuotas" → promesa_pago). Documentadas sin cambio: abono parcial sin monto explícito persiste el valor de la cuota completa (se documenta; el cliente normalmente menciona el monto); `intencionDetectada` siempre "promesa_pago" (coherente con reusar la intención top-level; el tipo queda en `promesas_pago.tipo`).
- Pendientes/seguimiento:
  - Ejecución de reprogramación real de cuotas — iteración transaccional con HU-31 (evaluación contra reglas) y HU-34 (acuerdos auditables).
  - Evaluación contra `reglas_negociacion_ia` (HU-31).
  - Derivación a humano de casos complejos (HU-32).
