# Tarea: Refactor de helpers compartidos (assertOwned y numericTransformer)

- **Origen:** backlog "assertOwned duplicado" y "numericTransformer duplicado" + Fase 0 del roadmap (ítem 3)
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Eliminar la duplicación del `assertOwned` (socio sobre sus rutas) y del `numericTransformer` (columnas numeric de Postgres) extrayéndolos a helpers compartidos en `src/common/`.

## Fuera de alcance
- Refactor de los módulos de cartera (`cliente.service.ts`, `prestamo.service.ts`, `prestamo.entity.ts`, `cuota.entity.ts`) — viven en la PR #17 (sin mergear a develop); se aplican cuando se mergee.
- El helper de unicidad/conflicto (23505) y `toPublic` de socios/cobradores (ítem del backlog aparte, se evalúa al tocar esos módulos).

## Bloques (checklist TDD)
- [x] Bloque 1: Crear `src/common/numeric-transformer.ts` y `src/common/ownership.ts` (`assertOwned` + `ACCESO_DENEGADO`).
- [x] Bloque 2: Aplicar `numericTransformer` compartido en `ruta.entity.ts`, `ruta-config.entity.ts` e `inyeccion.entity.ts` (sin cambio de comportamiento).
- [x] Bloque 3: Reemplazar el `assertOwned` local por el compartido en `rutas.service.ts`, `ruta-config.service.ts` e `inyecciones.service.ts`.
- Verificación: `scripts/check.sh` en verde (no cambia comportamiento).

## Decisiones tomadas durante la implementación
- `ownership.assertOwned(ruta, requester)` usa un tipo estructural `RequesterOwned { rol: RolUsuario; sub }`; los servicios con `rol: "admin" | "socio"` son asignables.
- `numeric-transformer.ts` exporta el transformer único usado por las columnas numeric.
- En esta rama (desde develop) los servicios aún tienen `rol: "admin" | "socio"` (el widening a `RolUsuario` está en la PR #18); por eso no se importa `RolUsuario` aquí.

## Ambigüedades resueltas con el usuario
- Ninguna (refactor sin decisión de negocio).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 185 tests en verde).
- Archivos modificados: `src/common/numeric-transformer.ts`, `src/common/ownership.ts`, `src/modules/rutas/{ruta,ruta-config,inyeccion}.entity.ts`, `src/modules/rutas/{rutas,ruta-config,inyecciones}.service.ts`, `docs/ai/tasks/refactor-helpers.md`.
- Pendientes/seguimiento: aplicar los helpers a los módulos de cartera (cliente/prestamo/cuota) cuando la PR #17 se mergee; el helper de unicidad/conflicto queda como ítem de backlog.
- **Revisión final (code-reviewer, 2026-08-17):** APROBADO CON OBSERVACIONES (sin bloqueantes). Se agregaron tests unitarios directos para `numeric-transformer` y `ownership` (`src/common/*.spec.ts`) tras la observación de cobertura. Observaciones restantes en backlog: ADR-0002 referencia HUs 49/55/59 que están en la PR #19 (asegurar orden de merge) y `ACCESO_DENEGADO` duplicado con `permiso.guard.ts` (unificar en limpieza futura).