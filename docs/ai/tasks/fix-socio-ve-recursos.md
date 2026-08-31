# Tarea: fix-socio-ve-recursos (acceso del socio a sus recursos en el panel)

- **Origen:** Bug reportado por el usuario: al ingresar al panel con el socio del seed no veía datos.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-31

## Objetivo
Permitir que el rol `socio` liste sus recursos propios en el panel: `GET /rutas`, `GET /cobradores` y `GET /socios`, filtrando por ownership.

## Causa raíz
`PermisoGuard` sin `@PermisoRequerido` deja la ruta como admin-only. Los endpoints de listado no tenían permiso (o uno incorrecto):
- `GET /rutas` — sin `@PermisoRequerido` → 403 para socio.
- `GET /cobradores` — `@PermisoRequerido("editar_permisos")` → 403 para socio sin ese permiso.
- `GET /socios` — sin `@PermisoRequerido` → 403 para socio.

Además, `RutasService.listar`/`SociosService.listar` no filtraban por ownership (devolvían todo).

## Bloques (checklist TDD)

- [x] Bloque 1: `GET /rutas` → `@PermisoRequerido("ver_reportes")` + `RutasService.listar(filtros, requester)` filtra `socio_id` si el requester es socio.
  - Test(s): `rutas.service.spec.ts` (ownership), `rutas.controller.spec.ts` (pasa contexto), e2e `un socio ve solo sus rutas`.
- [x] Bloque 2: `GET /cobradores` → permiso `ver_reportes` (el filtro por `socioId` del token ya existía).
- [x] Bloque 3: `GET /socios` → `@PermisoRequerido("ver_reportes")` + `SociosService.listar(filtros, requester)` devuelve solo el propio socio.
  - Test(s): `socios.service.spec.ts` (ownership), `socios.controller.spec.ts` (pasa contexto).

## Decisiones tomadas durante la implementación
- Se usa `ver_reportes` (permiso de lectura estándar del proyecto) para los listados; un socio sin `ver_reportes` no vería los listados del panel.
- `GET /socios/:id` (getById) se deja admin-only (sin cambios).
- E2e ahora corre contra BD dedicada (ya cubierto en el fix de listado de gastos).

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (738 tests, 85 suites); e2e de rutas verde (27 tests, incluido ownership); verificado por API real con el socio del seed: `/rutas` (2), `/cobradores` (2), `/socios` (1), detalle de ruta y cartera 200.
- Archivos modificados:
  - `src/modules/rutas/rutas.service.ts`, `rutas.controller.ts` (+ specs).
  - `src/modules/socios/socios.service.ts`, `socios.controller.ts` (+ specs).
  - `src/modules/cobradores/cobradores.controller.ts`.
  - `test/e2e/rutas.e2e-spec.ts` — test de ownership.
  - `docs/ai/tasks/fix-socio-ve-recursos.md`.
- Pendientes/seguimiento: verificar en el panel que la navegación del socio (rutas/cobradores/cartera) funciona de punta a punta.