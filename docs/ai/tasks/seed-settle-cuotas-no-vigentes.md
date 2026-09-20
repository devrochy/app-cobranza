---
estado: en progreso
tags: [tarea]
---

# Tarea: Seed — liquidar/cancelar cuotas de préstamos no vigentes

- **Origen:** Petición directa del usuario (2026-09-19) al detectar en la APK que un cliente con un préstamo "liquidado" con cuota `atrasada` aparecía como "al día".
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-19

## Objetivo

Que los préstamos que el seed marca como `liquidado`/`cancelado` no dejen sus cuotas en
`pendiente`/`atrasada`, para que no aparezcan como "mora fantasma" en la APK (el
filtro de la lista solo cuenta préstamos `vigente`, pero el detalle del cliente sí
mostraba esas cuotas vencidas).

## Fuera de alcance

- Cambiar la lógica de `diasMora`/filtros de la APK (ya es correcta para préstamos vigentes).
- Cambiar el flujo real de liquidación por abono (documentado en `estadisticas-cartera.service.ts:205`: un préstamo liquidado por abono deja cuotas sin tocar; otros consumidores ya filtran por `vigente`).

## Bloques (checklist TDD)

- [x] Bloque 1: al marcar un préstamo `liquidado`/`cancelado` en `sembrarManizales`, el seed marca sus cuotas como `pagada`.
  - Test(s): `src/modules/test-data/test-data.seed.service.spec.ts`

## Decisiones tomadas durante la implementación

- Se usa `cuotaRepo.update({ prestamo: { id } }, { estatus: "pagada" })` (no existe estatus `cancelada` de cuota; "pagada" evita que queden vencidas).
- Solo aplica a `sembrarManizales`, que es donde vive la lógica multi-préstamo (`id % 3`).
- Requiere re-seed de la cartera Manizales para verse en la BD local (el seed es idempotente y omite carteras existentes).

## Ambigüedades resueltas con el usuario

- El "bug de mora" es datos del seed → se corrige aquí (no en la APK).

## Resultado final (llenar al completar)

- Comandos ejecutados para verificar: `bash scripts/check.sh` → lint OK, typecheck OK, **120 suites / 1024 tests**.
- Archivos modificados: `src/modules/test-data/test-data.seed.service.ts` (+ `.spec.ts`), `docs/ai/tasks/seed-settle-cuotas-no-vigentes.md`.
- Pendientes/seguimiento (si algún punto quedó fuera): el seed es idempotente (omite carteras existentes), así que para verse reflejado en la BD local hay que re-sembrar (borrar las carteras `test-*` y reiniciar el backend con `SEED_TEST_DATA=true`) — operación destructiva local pendiente de confirmación del usuario.
