# Tarea: cartera-reportes-global (secciones consolidadas de cartera y reportes)

- **Origen:** Plan aprobado por el usuario (sesión de cartera y reporte consolidada global en el panel).
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-31

## Objetivo
Exponer endpoints globales para el panel:
- `GET /cartera/clientes` — clientes de todas las rutas del requester (admin: todas; socio: sus rutas), con `rutaNombre`.
- `GET /reportes/liquidaciones` — liquidaciones de las rutas del requester, ordenadas por fecha DESC, con `rutaNombre`.

## Fuera de alcance
- Descarga de evidencias, series históricas del dashboard, seguridad (rate limiting/JwtAuthGuard): otros ítems de backlog.
- Frontend (páginas /cartera y /reportes): se hace en `app-cobranza-admin` (task `cartera-reportes-secciones`).

## Bloques (checklist TDD)

- [x] Bloque 1: `ClienteService.listarGlobal(requester, filtros)` + `GET /cartera/clientes` (`@Controller("cartera")`), permiso `configurar_ruta`.
  - Test(s): `cliente.service.spec.ts` (scope admin/socio, filtros ILIKE/estatus/riesgo), `cartera-global.controller.spec.ts`.
  - **Hecho (2026-08-31):** query builder con `innerJoinAndSelect ruta` + `ruta.socio_id` para socio.
- [x] Bloque 2: `LiquidacionesService.listarGlobal(requester)` + `GET /reportes/liquidaciones` (`@Controller("reportes")`), permiso `ver_reportes`.
  - Test(s): `liquidaciones.service.spec.ts` (scope), `reportes-global.controller.spec.ts`.
  - **Hecho (2026-08-31):** `find` con `relations: { ruta: true }` y scope por `ruta.socio_id` para socio.
- [x] Bloque 3: e2e de scope (admin ve todas, socio solo las suyas).
  - Test(s): `cartera-reportes-global.e2e-spec.ts` (4 tests) + `scripts/check.sh`.
  - **Hecho (2026-08-31):** e2e contra `app_cobranza_e2e`. Se detectó que el seed (SEED_TEST_DATA=true) corría durante los e2e y contaminaba la BD e2e → `setup.ts` ahora fuerza `SEED_TEST_DATA=false` en e2e y se recreó la BD e2e. Verificado en vivo (admin y socio).

## Decisiones tomadas durante la implementación
- Permisos: cartera global `configurar_ruta` (consistente con el listado per-ruta de clientes); reportes global `ver_reportes`.
- Scope por ownership: admin → sin filtro; socio → `ruta.socio_id = sub` (patrón `DashboardService.resolverRutaIds`).
- `ClienteGlobalPublic` = `ClientePublic` + `rutaNombre`. `LiquidacionGlobalPublic` = `LiquidacionPublic` + `rutaNombre`.
- Filtros de cartera global: `busqueda` (ILIKE), `estatus`, `colorRiesgo`.

## Ambigüedades resueltas con el usuario
- (defaults aprobados por el usuario al aprobar el plan)

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (749 tests, 88 suites); e2e `cartera-reportes-global` verde (4 tests); verificado en vivo (admin: 16 clientes + 1 liquidación; socio: mismos por ser el único).
- Archivos modificados:
  - `src/modules/cartera/cliente.service.ts` (+ spec) — `listarGlobal` + `ClienteGlobalPublic`.
  - `src/modules/cartera/cartera-global.controller.ts` (+ spec) + `dto/listar-clientes-global.dto.ts`.
  - `src/modules/rutas/liquidaciones.service.ts` (+ spec) — `listarGlobal` + `LiquidacionGlobalPublic`.
  - `src/modules/rutas/reportes-global.controller.ts` (+ spec).
  - `src/modules/cartera/cartera.module.ts`, `src/modules/rutas/rutas.module.ts` — registran los controllers.
  - `test/e2e/cartera-reportes-global.e2e-spec.ts` (nuevo), `test/e2e/setup.ts` (SEED_TEST_DATA=false en e2e).
  - `docs/ai/tasks/cartera-reportes-global.md`.
- Pendientes/seguimiento:
  - El frontend (`cartera-reportes-secciones`) consume estos endpoints para las páginas /cartera y /reportes.
  - Paginación/límite en `GET /cartera/clientes` (volumen global) — candidato a backlog.
  - e2e de 403 para socio sin `configurar_ruta`/`ver_reportes` en estos endpoints (gap menor de cobertura, patrón ya cubierto por PermisoGuard).