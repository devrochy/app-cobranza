# Tarea: dashboard-filtrable

- **Origen:** Petición del usuario (panel admin `app-cobranza-admin`, mejora de producto P5): el dashboard consolidado es global; se quiere filtrar por ruta o socio.
- **Estado:** completada / mergeada (PR #69)
- **Fecha inicio:** 2026-08-28
- **Fecha merge:** 2026-08-28
- **Commit del squash:** `6a637e8` (`feat(dashboard): permitir filtrar el dashboard por ruta y socio (#69)`)

## Objetivo
`GET /dashboard` acepta `?rutaId=` y `?socioId=` (opcionales) y agrega los indicadores sobre ese subconjunto (admin-only, igual que hoy).

## Fuera de alcance
- Gráficos/series históricas (el endpoint sigue devolviendo el snapshot; los gráficos son decisión del panel).
- Filtro por fecha/período.

## Bloques (checklist TDD)

- [x] Bloque 1: DTO `ListarDashboardDto` (rutaId?, socioId?) + controller pasa los query params.
  - **Hecho (2026-08-28):** `dto/listar-dashboard.dto.ts` (ints opcionales, min 1); controller `dashboard(@Query() dto)` → `service.obtener(new Date(), { rutaId, socioId })`. Spec actualizado (3 tests: delega, pasa filtros, filtros vacíos).
  - Test(s): `src/modules/dashboard/dashboard.controller.spec.ts`.
- [x] Bloque 2: `DashboardService.obtener(hoy, filtros)` filtra por `rutaId`/`socioId` en todos los agregados.
  - **Hecho (2026-08-28):** `resolverRutaIds` (rutaId → [id]; socioId → rutas del socio; ninguno → undefined). Filtros: cuotas vía `prestamo.ruta.id`; pagos vía `cliente.rutaId` (Pago no tiene ruta directa); abonos vía `prestamo.rutaId`; gastos/liquidaciones vía `rutaId`; conteos vía `rutaId`/`id` de socio. `resolverSocioIds` deriva los socios de las rutas filtradas. Spec: 2 tests nuevos (filtro por rutaId y por socioId). `scripts/check.sh` verde (726 tests).
  - Test(s): `src/modules/dashboard/dashboard.service.spec.ts` + e2e (`test/e2e/dashboard.e2e-spec.ts`, filtro por rutaId).

## Contratos
- `GET /dashboard?rutaId=6` → indicadores solo de la ruta 6.
- `GET /dashboard?socioId=3` → indicadores de las rutas del socio 3.
- Sin filtros → comportamiento actual (global).

## Decisiones tomadas durante la implementación
- Los filtros se aplican en las queries de agregación (sum/count) con `In`, sin joins explícitos.
- Pago/Abono no tienen relación directa a Ruta: se filtran vía la relación `ruta.id` de sus entidades padre (`cliente.ruta.id` / `prestamo.ruta.id`). **Lección del e2e (CI):** TypeORM no resuelve `RelationId` en filtros de `sum`/`count` ni en `select` de `find` (falló en `Cliente`, `Gasto` y `Ruta.socioId`). El servicio usa SIEMPRE relaciones (`ruta.id`, `socio.id`), `rutasActivas` filtra por `id: In`, y los `socioId` se leen desde las entidades cargadas.
- `rutasActivas` filtra por `id: In` (Ruta no tiene `rutaId`); `sociosActivos` con filtro de ruta deriva los socios de las rutas filtradas.

## Ambigüedades resueltas con el usuario
- Coordinar la tarea backend del dashboard filtrable (opción del usuario tras el mapa).

## Resultado final
- Comandos ejecutados para verificar:
  - `scripts/check.sh` → OK (726 tests, 85 suites).
  - `scripts/test-e2e.sh` → no ejecutado localmente (BD caída); el e2e nuevo corre en CI.
- Archivos modificados:
  - `src/modules/dashboard/dto/listar-dashboard.dto.ts` (nuevo).
  - `src/modules/dashboard/dashboard.controller.ts` — `dashboard(@Query() dto)`.
  - `src/modules/dashboard/dashboard.service.ts` — `obtener(hoy, filtros)` + `resolverRutaIds`/`resolverSocioIds`.
  - Specs: `dashboard.controller.spec.ts`, `dashboard.service.spec.ts`, `test/e2e/dashboard.e2e-spec.ts`.
  - `docs/ai/tasks/dashboard-filtrable.md`.
- Pendientes/seguimiento:
  - El panel (`app-cobranza-admin`) debe pasar `?rutaId=`/`?socioId=` y una librería de gráficos (decisión del usuario).