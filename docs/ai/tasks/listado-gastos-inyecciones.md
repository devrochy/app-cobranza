# Tarea: listado-gastos-inyecciones (GET de listado para el panel)

- **Origen:** Ítem de backlog del panel admin (`docs/ai/tasks/backlog.md` de `app-cobranza-admin`): acciones sin UI (`aprobarGastoRutaAction`, `eliminarGastoRutaAction`, `eliminarInyeccionRutaAction`) bloqueadas por falta de `GET /rutas/:id/gastos` e `inyecciones`.
- **Estado:** en progreso (pendiente commit + PR)
- **Fecha inicio:** 2026-08-28

## Objetivo
Exponer dos endpoints de lectura para que el panel admin liste la operación de una ruta:
- `GET /rutas/:id/gastos` — gastos activos DESC por fechaHora, cada uno con sus evidencias.
- `GET /rutas/:id/inyecciones` — inyecciones activas DESC por fechaHora.

## Fuera de alcance
- UI del panel (listado + botones aprobar/eliminar): se hace en `app-cobranza-admin` en otra tarea.
- Servir/descargar los archivos de evidencia (URL accesible): pendiente si el panel necesita verlos (el listado expone los metadatos).
- Trayectoria real: el endpoint `GET /rutas/:id/dia/trayectorias` ya existe y devuelve GeoJSON con planificada + real; no requiere cambios de backend.

## Bloques (checklist TDD)

- [x] Bloque 1: `GastosService.listar(rutaId, requester)` → gastos `estado: "activo"` DESC con `evidencias[]`.
  - Test(s): `gastos.service.spec.ts` — hecho (listar con evidencias, filtro activos verificado en el query, ruta inexistente).
  - **Hecho (2026-08-28):** `listar` consulta `estado: "activo"` DESC por `fechaHora` y agrupa evidencias en 1 query (`gastoId: In(...)` con `order: { id: "ASC" }`). `GastoPublic` ahora incluye `evidencias: GastoEvidenciaPublic[]`.
  - **Revisión code-reviewer (2026-08-28):** aprobado. Ajustes aplicados: query de evidencias por `gastoId` (micro-optimización) con `order` estable; tests de edge cases (gasto sin evidencias, lista vacía sin llamada a `find`, 403 de listar en ruta ajena). `rutaArchivo` expone ruta del filesystem — aceptable para panel interno, seguimiento registrado (descarga de evidencias).
- [x] Bloque 2: `InyeccionesService.listar(rutaId, requester)` → inyecciones `estado: "activa"` DESC.
  - Test(s): `inyecciones.service.spec.ts` — hecho (listar, filtro activas en el query, ruta inexistente).
  - **Hecho (2026-08-28):** `listar` consulta `estado: "activa"` DESC por `fechaHora`.
- [x] Bloque 3: endpoints en `rutas.controller.ts` con permiso `ver_reportes`.
  - Test(s): `rutas.controller.spec.ts` — hecho (delega en `gastosService.listar` e `inyeccionesService.listar`).
  - **Hecho (2026-08-28):** `GET /rutas/:id/gastos` y `GET /rutas/:id/inyecciones`.

## Decisiones tomadas durante la implementación
- Listado solo de ítems activos (soft-delete es para trazabilidad, no se muestran en el panel).
- Permiso de lectura: `ver_reportes` (igual que caja/resumen/liquidaciones).
- `GastoPublic` gana el campo `evidencias: GastoEvidenciaPublic[]` (id, nombreOriginal, mimetype, tamaño, rutaArchivo).

## Ambigüedades resueltas con el usuario
- ¿Qué debe devolver el listado? → Solo activos DESC + evidencias del gasto incluidas.

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (736 tests, 85 suites).
- Archivos modificados:
  - `src/modules/rutas/gastos.service.ts` — `listar` + `GastoEvidenciaPublic` + `GastoPublic.evidencias`.
  - `src/modules/rutas/inyecciones.service.ts` — `listar`.
  - `src/modules/rutas/rutas.controller.ts` — `GET :id/gastos` y `GET :id/inyecciones`.
  - `gastos.service.spec.ts`, `inyecciones.service.spec.ts`, `rutas.controller.spec.ts` — tests nuevos (incl. edge cases).
  - `docs/ai/tasks/listado-gastos-inyecciones.md`.
- Revisión de `code-reviewer`: aprobado (ajustes de micro-optimización y edge cases aplicados).
- Pendientes/seguimiento:
  - Servir/descargar los archivos de evidencia (URL accesible con control de ownership): pendiente cuando el panel lo requiera (backlog existente "Endpoint de descarga de evidencia de gasto").
  - El panel (`app-cobranza-admin`) puede consumir estos endpoints para las acciones sin UI (aprobar/eliminar gasto, eliminar inyección).