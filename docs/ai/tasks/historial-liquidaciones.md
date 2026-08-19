# Tarea: Historial de liquidaciones consultable y exportable (HU-22/HU-50)

- **Origen:** Roadmap Fase 2 ítem 15 (docs/plan-feature-roadmap.md:36) — HU-22 (docs/APP_REQUIREMENTS.md:74) y HU-50 (:75).
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Historial consultable de liquidaciones de una ruta (una liquidación diaria ES el reporte diario, decisión del usuario) y exportación a Excel (.xlsx con `exceljs`) de cada liquidación.

## Fuera de alcance
- Entidad `reportes_diarios` separada con clientes visitados/sin pago (motivos, días de mora) y trayectorias (GeoJSON) — HU-18/HU-49, Fase 3 (ítem 22).
- Dashboard ejecutivo (HU-23).
- Detalle/resumen completo de ruta (HU-51 → ítem 16).
- Edición de liquidaciones (snapshot inmutable).

## Decisiones tomadas durante la implementación
- Reporte diario = la liquidación diaria (no entidad separada); HU-50 se satisface con el historial de `liquidaciones`.
- Exportación con `exceljs` (.xlsx real, MIT, sin costo).
- Historial gated por `ver_reportes`; exportación gated por `descargar_reporte`.
- Historial = lista de liquidaciones de la ruta (orden fecha DESC).

## Bloques (checklist TDD)
- [x] Bloque 0: Instalar `exceljs` (^4.4.0) y agregar a `package.json`.
- [x] Bloque 1: `LiquidacionesService.listar` — lista de liquidaciones (fecha DESC), con `assertOwned`. Tests unitarios.
- [x] Bloque 2: `LiquidacionesService.exportar` — genera buffer .xlsx con `exceljs` (hoja "Liquidación" con los campos de negocio de la liquidación: fecha, periodo, caja anterior/actual, estimado, inyección, cobrado periodo/día, prestado, gastos, cartera, comisión % y valor, comentario). Tests unitarios (incluye validación del contenido del xlsx con exceljs).
- [x] Bloque 3: Endpoints `GET /rutas/:id/liquidaciones` (ver_reportes) y `GET /rutas/:id/liquidaciones/:liquidacionId/export` (descargar_reporte) con `res` + headers Content-Type/Disposition. + e2e (4 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: reporte diario → **la liquidación diaria es el reporte**.
- Pregunta: exportación → **exceljs (.xlsx real)**.
- Pregunta: permisos → **ver_reportes** (historial) + **descargar_reporte** (exportación).
- Pregunta: historial → **liquidaciones** (una por día = reporte).

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `historial-liquidaciones.e2e-spec.ts`, 4 tests).
- Archivos modificados:
  - `package.json`/`package-lock.json` — dependencia `exceljs`.
  - `src/modules/rutas/liquidaciones.service.ts` (+spec) — `listar` y `exportar` (buffer .xlsx + filename).
  - `src/modules/rutas/rutas.controller.ts` (+spec) — `GET /rutas/:id/liquidaciones` y `GET .../:liquidacionId/export`.
  - `test/e2e/historial-liquidaciones.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/historial-liquidaciones.md` (este archivo).
- Pendientes/seguimiento:
  - Detalle de clientes visitados/sin pago (motivos, días de mora) y trayectorias GeoJSON en el reporte (HU-18/HU-49 → Fase 3, ítem 22).
  - Dashboard ejecutivo (HU-23).
  - Detalle/resumen de ruta (HU-51 → ítem 16).
  - El .xlsx exportado refleja los campos de negocio de la liquidación (no trayectorias/visitas).
  - `listar` sin paginación (historial completo); anotar en backlog si el volumen diario lo requiere.
- Revisión independiente (code-reviewer, 2026-08-19): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) e2e de 403 para historial y export; (b) validación del contenido del .xlsx con exceljs en el test unitario; (c) corrección de doc (campos exportados). Nits documentados sin cambio: `Buffer.from(buffer)` redundante (inofensivo), filename laxo en test (ahora exacto), `listar` sin paginación (registrado arriba).