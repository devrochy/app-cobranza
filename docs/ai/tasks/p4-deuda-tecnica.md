---
estado: completada
tags: [tarea]
---

# Tarea: P4 — Deuda técnica (helpers compartidos y código muerto)

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P4**; ítems del backlog de deuda técnica.
- **Estado:** completada
- **Fecha inicio:** 2026-09-12

## Objetivo
Eliminar duplicación y código muerto del backend sin cambiar comportamiento.

## Bloques (checklist TDD)
- [x] Bloque 1: extraer `isUniqueViolation` a `src/common/db-errors.ts` (4 copias).
  - Test(s): `src/common/db-errors.spec.ts`
- [x] Bloque 2: eliminar `RutasService.aplicarCascada` (código muerto) y su spec.
- [x] Bloque 3: eliminar `esMetodoPagoValido`/`esMotivoNoPagoValido` (sin uso) y sus tests.
- [x] Bloque 4: unificar `ACCESO_DENEGADO` en `src/common/ownership.ts`.

## Decisiones tomadas durante la implementación
- `fechaLocal` (hora local) es distinto de `formatDate` (UTC); NO se reemplaza, queda como pendiente de deduplicación propia.
- Se dejaron para un ítem aparte: helpers geo `ST_Y/ST_X`, helper de fila de auditoría, fábrica de upload y observabilidad (P4.2).

## Ambigüedades resueltas con el usuario
- P4 dividido en P4.1 (helpers/código muerto) y P4.2 (observabilidad).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (111 suites, 986 tests) + `npm run test:e2e` (58 suites, 421 tests) → verde.
- Archivos modificados:
  - `src/common/db-errors.ts` (+ `.spec.ts`) — helper `isUniqueViolation`.
  - `src/modules/{socios/socios,cobradores/cobradores,cobros-socio/cobros-socio,sincronizacion-offline/sincronizacion-offline}.service.ts` — usan el helper.
  - `src/modules/rutas/rutas.service.ts` (+ `.spec.ts`) — se elimina `aplicarCascada`.
  - `src/domain/metodo-pago.ts` (+ `.spec.ts`), `src/domain/motivos-no-pago.ts` (+ `.spec.ts`) — se eliminan los guards sin uso.
  - `src/modules/auth/{permiso.guard,cobrador-permiso.guard}.ts`, `src/modules/cobradores/cobradores.controller.ts` — `ACCESO_DENEGADO` desde `common/ownership`.
  - `docs/ai/tasks/backlog.md` — ítems movidos a historial.
- Pendientes/seguimiento: `fechaLocal`, helpers geo/auditoría/upload y observabilidad (P4.2).