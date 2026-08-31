# Tarea: fix-listado-gastos-evidencia (listado de gastos con evidencias)

- **Origen:** Bug detectado en pruebas visuales del panel (entrar a `test-Ruta Centro` → 500): `EntityPropertyNotFoundError: Property "gastoId" was not found in "GastoEvidencia"`.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-31

## Objetivo
Corregir `GastosService.listar` para que el query de evidencias use la forma por relación (`gasto: { id: In(...) }`) en lugar de la propiedad `@RelationId` (`gastoId`), que TypeORM no resuelve en `where` y lanza 500.

## Causa raíz
En el PR #70 se "optimizó" el `where` de evidencias de `{ gasto: { id: In(...) } }` a `{ gastoId: In(...) }` siguiendo una sugerencia de review. La columna física existe (`gasto_id`) pero la propiedad `gastoId` es `@RelationId` y TypeORM no la acepta en el criterio de `find` (falla en `SelectQueryBuilder.buildWhere`). Los unitarios mockeaban el repo (no detectaban la query real) y el e2e de gastos no cubría el listado.

## Bloques (checklist TDD)

- [x] Bloque 1: corregir el `where` en `GastosService.listar`.
- [x] Bloque 2: test de regresión e2e `GET /rutas/:id/gastos lista los gastos activos con sus evidencias` (ejercita la query real).
- [x] Bloque 3: e2e aislado de la BD de desarrollo (setup.ts apunta a `app_cobranza_e2e` para no pisar el seed).

## Decisiones tomadas durante la implementación
- `setup.ts` de e2e ahora apunta `DATABASE_URL` a `app_cobranza_e2e` (BD dedicada): las e2e locales ya no destruyen la data de prueba del dev (el cleanup de gastos/rutas borra todas las filas).

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (736 tests, 85 suites); `jest --config test/jest-e2e.config.js gastos.e2e-spec` verde (6 tests, incluido el de regresión); endpoint verificado por API (200 con evidencias) y panel recarga.
- Archivos modificados:
  - `src/modules/rutas/gastos.service.ts` — `where: { gasto: { id: In(...) } }`.
  - `test/e2e/gastos.e2e-spec.ts` — test de regresión del listado.
  - `test/e2e/setup.ts` — BD e2e dedicada.
  - `docs/ai/tasks/fix-listado-gastos-evidencia.md`.
- Pendientes/seguimiento: registrar en backlog del backend que los e2e no deben depender de `gastoId` en `where` (preferir relación); al re-correr el seed de dev se restauran los gastos borrados por el e2e anterior.