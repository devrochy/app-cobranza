# Tarea: listado-rutas

- **Origen:** Petición directa del usuario (panel admin Fase P2 — `docs/plan-panel-admin.md` del repo `app-cobranza-admin`). El listado `GET /rutas` no existe en el backend.
- **Estado:** completada
- **Fecha inicio:** 2026-08-27

## Objetivo
El admin obtiene el listado de rutas (`GET /rutas`) con filtros opcionales `busqueda` y `estatus`, para alimentar la pantalla de gestión de rutas del panel.

## Fuera de alcance
- Paginación (array plano; deuda en `docs/ai/tasks/backlog.md`).
- Listado para rol socio (admin-only).
- Listados de inyecciones/gastos (`GET /rutas/:id/inyecciones` / `gastos`) — decidido no incluirlos.
- Cargar relaciones socio/cobrador en el listado (el panel cruza con `GET /socios` y `GET /cobradores`).
- Detalle de ruta (`GET /rutas/:id`).

## Bloques (checklist TDD)

- [x] Bloque 1: `ListarRutasDto` (`busqueda`, `estatus` opcionales) y `RutasService.listar` con filtros (ILIKE sobre `nombre`/`descripcion` y estatus) y orden `id ASC`, retornando `RutaPublic[]`.
  - Test(s): `src/modules/rutas/rutas.service.spec.ts` (describe `listar`, 5 casos).
- [x] Bloque 2: `GET /rutas` admin-only en el controller.
  - Test(s): `src/modules/rutas/rutas.controller.spec.ts`, `test/e2e/rutas.e2e-spec.ts`.
- Verificación: `scripts/check.sh` (711 unit) + `scripts/test-e2e.sh` (336) en verde.

## Decisiones tomadas durante la implementación
- Búsqueda ILIKE sobre `nombre` y `descripcion` (campos de texto de `Ruta`); `trim()` y estatus con `andWhere`; orden `id ASC`. `getMany` respeta `select: false`.
- Acceso admin-only sin `@PermisoRequerido` (consistente con `GET /socios`, `GET /cobros-socio`).
- Sin paginación (array plano).
- E2E: el test de cascada previo deja el cobrador `CB-RT-1` bloqueado; el `beforeAll` del listado lo reactiva antes de crear "Ruta Bloqueada".

## Ambigüedades resueltas con el usuario
- Pregunta: ¿solo GET /rutas o también GET inyecciones/gastos? → **Solo GET /rutas**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar:
  - `scripts/check.sh` → OK (711 tests).
  - `scripts/test-e2e.sh` → OK (336 tests, 49 suites).
- Archivos modificados:
  - `src/modules/rutas/dto/listar-rutas.dto.ts` (nuevo).
  - `src/modules/rutas/rutas.service.ts` — `ListarRutasFiltros` + `listar`.
  - `src/modules/rutas/rutas.controller.ts` — `@Get()` admin-only.
  - `src/modules/rutas/rutas.service.spec.ts` (describe `listar`, 5 tests).
  - `src/modules/rutas/rutas.controller.spec.ts` (delegación).
  - `test/e2e/rutas.e2e-spec.ts` (describe `GET /rutas (listado)`, 6 tests).
  - `docs/ai/tasks/listado-rutas.md` (este archivo).
- Revisión independiente (code-reviewer): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Aplicado: desacople del e2e "filtra por estatus" (reactiva "Ruta E2E" en beforeAll). Resto (escapado de comodines ILIKE, `unaccent`, `@MaxLength`, e2e por campo) ya registrados como deuda en el backlog de socios (`listado-socios`) — se comparten las observaciones.
- Pendientes/seguimiento: al aterrizar el PR, el panel (B2 de `gestion-rutas`) consume `GET /rutas?busqueda=&estatus=`.