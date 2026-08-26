# Tarea: listado-socios

- **Origen:** Petición directa del usuario (panel admin Fase P2 — `docs/plan-panel-admin.md` del repo `app-cobranza-admin`). El listado `GET /socios` no existe en el backend.
- **Estado:** completada
- **Fecha inicio:** 2026-08-26

## Objetivo
El admin obtiene el listado completo de socios (`GET /socios`) con filtros opcionales por texto (`busqueda`) y estatus, para alimentar la pantalla de gestión de socios del panel.

## Fuera de alcance
- Paginación (`page`/`limit`/`{ total, items }`) — array plano; deuda anotada en `docs/ai/tasks/backlog.md`.
- Listado para rol socio (admin-only; un socio no lista todos los socios).
- Cargar relaciones o conteos de cobradores/rutas por socio.
- Ordenación configurable (solo `id ASC`).

## Bloques (checklist TDD)

- [x] Bloque 1: `ListarSociosDto` (`busqueda`, `estatus` opcionales) y `SociosService.listar` con filtros (ILIKE sobre usuario/nombre/apellido/correo/codigo/telefono y estatus) y orden `id ASC`, retornando `SocioPublic[]` sin `passwordHash`.
  - Test(s): `src/modules/socios/socios.service.spec.ts` (describe `listar`, 5 casos).
- [x] Bloque 2: `GET /socios` admin-only en el controller (delegación + e2e de listado y filtros).
  - Test(s): `src/modules/socios/socios.controller.spec.ts`, `test/e2e/socios.e2e-spec.ts`.
- Verificación: `scripts/check.sh` + `scripts/test-e2e.sh` (BD arriba).

## Decisiones tomadas durante la implementación
- Búsqueda con `QueryBuilder` + `ILIKE` (case-insensitive) sobre `usuario|nombre|apellido|correo|codigo|telefono`, con `trim()` (busqueda de solo espacios → sin filtro); `estatus` con `andWhere`. `getMany` respeta `select: false` de `passwordHash`.
- Acceso **admin-only** sin `@PermisoRequerido` (consistente con `GET /cobros-socio` y `GET /conversaciones-socio`): un socio no lista todos los socios.
- Sin paginación (decisión del usuario); array plano ordenado `id ASC` como `GET /cobradores`.
- El e2e usa un tercer fixture `SC-E2E-003` (bloqueado) para probar el filtro por estatus sin tocar los socios `SC-E2E-001/002` que usan otros tests de configuración.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿paginación en `GET /socios`? → **Array plano sin paginar** (consistente con `GET /cobros-socio` y `GET /cobradores`; el panel filtra en cliente).
- Pregunta: ¿acceso? → **Admin-only** (sin `@PermisoRequerido`, igual que `GET /cobros-socio` y `GET /conversaciones-socio`).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar:
  - `scripts/check.sh` → OK (705 tests, 85 suites).
  - `scripts/test-e2e.sh` → OK (330 tests, 49 suites).
- Archivos modificados:
  - `src/modules/socios/dto/listar-socios.dto.ts` (nuevo) — DTO de query params `busqueda`/`estatus`.
  - `src/modules/socios/socios.service.ts` — `ListarSociosFiltros` + método `listar`.
  - `src/modules/socios/socios.controller.ts` — `@Get()` admin-only con `@Query(ListarSociosDto)`.
  - `src/modules/socios/socios.service.spec.ts` — describe `listar` (5 tests).
  - `src/modules/socios/socios.controller.spec.ts` — test de delegación de `listar`.
  - `test/e2e/socios.e2e-spec.ts` — describe `GET /socios (listado)` (6 tests).
  - `docs/ai/tasks/listado-socios.md` (este archivo).
- Revisión independiente (code-reviewer): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Observaciones: (1) baja — comodines ILIKE `%`/`_` en `busqueda` no se escapan (comportamiento wildcard, no inyección); (2) baja — ILIKE no es accent-insensitive (`perez` no matchea `Pérez`); (3) baja — e2e solo ejercita busqueda por `nombre`; (4) muy baja — `@MaxLength` no declarado en `busqueda`; (5) muy baja — sin e2e de `forbidNonWhitelisted` en query. Pendientes de decisión del usuario: búsqueda literal vs comodín y normalización de tildes (`unaccent`) — no bloqueantes para esta iteración.
- Pendientes/seguimiento: la paginación queda como deuda en `docs/ai/tasks/backlog.md`. Al aterrizar el PR, el panel (B8 de `gestion-socios`) consume `GET /socios?busqueda=&estatus=`. Observaciones del code-reviewer (escapado de comodines, `unaccent`, `@MaxLength`, e2e por campo) quedan como candidatos a backlog.