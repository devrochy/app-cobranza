---
estado: en progreso
tags: [tarea]
---

# Tarea: Limpieza de backlog stale (backend)

- **Origen:** Petición directa del usuario (2026-09-12) — Parte A del plan de priorización: varios ítems del `backlog.md` ya estaban resueltos por tareas mergeadas (Fase 0 del roadmap y otros), lo que distorsiona la priorización.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-12

## Objetivo
Dejar el `backlog.md` del backend con solo pendientes reales, moviendo a "Resueltos (historial)" los ítems ya implementados.

## Fuera de alcance
- Resolver ítems de deuda pendientes (van en P0/P4).
- Panel y APK.

## Bloques (checklist TDD)
- [x] Bloque 1: verificar cada ítem candidato contra el código/tareas mergeadas y depurar.

## Decisiones tomadas durante la implementación
- Se conserva `RutasService.aplicarCascada` como pendiente (sigue existiendo, `rutas.service.ts:116`).
- Cobertura de `PermisoGuard`: solo `health` (público) y `perfil` (self-service) no lo usan — intencional; el ítem "asegurar PermisoGuard" queda satisfecho.

## Ambigüedades resueltas con el usuario
- (ninguna)

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (107 suites, 967 tests) → verde (docs-only).
- 11 ítems movidos a "Resueltos (historial)": Fase 0 (revalidar #18, cascada #20, helpers #21, PostGIS #22), `prestamos.tipo_interes`, `refresh` cobrador, `assertOwned` del cobrador, Actor Cobrador en gastos, `whatsapp-simulado` sin PermisoGuard, ADR-0002/PR #19, pago conserva valor histórico.
- Actualizado el ítem de `isUniqueViolation` (sigue pendiente: 4 copias; `assertOwned`/`numericTransformer` ya se extrajeron).
- Pendientes/seguimiento: ninguno.