# Tarea: Persistir trayectorias planificada y real en reporte diario (HU-49)

- **Origen:** Roadmap Fase 3 ítem 22 (docs/plan-feature-roadmap.md:46) — HU-49 (docs/APP_REQUIREMENTS.md:66), amplía HU-18/HU-38. Tabla `reportes_diarios` PRD 4.2:320.
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Persistir las trayectorias planificada y real del día en formato GeoJSON (LineString estricto) en `reportes_diarios.trayectorias_json`, con registro manual de la trayectoria real (sin APK/tracking GPS en MVP) y consulta para auditoría (HU-38).

## Fuera de alcance
- Tracking GPS en vivo (HU-44, condicionada) — la real es manual.
- Reporte diario con mapa renderizado en front (el backend solo provee GeoJSON).
- Notificaciones (Fase 4).
- Dashboard ejecutivo (HU-23).
- Exportación del reporte diario a Excel.

## Decisiones tomadas durante la implementación
- Crear entidad `ReporteDiario` (PRD 4.2:320) con `trayectorias_json` en GeoJSON LineString estricto.
- Trayectoria planificada derivada de `ruta_optimizada_log` (HU-55, tipo planificada) → GeoJSON.
- Trayectoria real: registro manual via `POST /rutas/:id/dia/trayectoria-real` (puntos GeoJSON), persistida como tipo `real` en `ruta_optimizada_log`.
- Consulta via `GET /rutas/:id/dia/trayectorias` (ver_reportes).
- Función pura de conversión a GeoJSON en `src/domain`.

## Bloques (checklist TDD)
- [x] Bloque 0: Función pura `trayectoriasAGeoJSON` (FeatureCollection de LineStrings, `[lng,lat]`) en `src/domain/trayectorias.ts`. 3 tests.
- [x] Bloque 1: Entidad `ReporteDiario` (PRD 4.2:320) + registro en módulo.
- [x] Bloque 2: `TrayectoriasService` — `registrarReal` (POST trayectoria real), `generarReporteDiario` (consolida en reportes_diarios), `consultar` (GET). 5 tests unitarios.
- [x] Bloque 3: Endpoints `POST /rutas/:id/dia/trayectoria-real` y `GET /rutas/:id/dia/trayectorias` (ver_reportes) + DTO `RegistrarTrayectoriaRealDto` + e2e (5 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: reporte destino → **crear entidad reportes_diarios**.
- Pregunta: captura real → **registro manual de puntos**.
- Pregunta: formato → **GeoJSON LineString estricto**.
- Pregunta: consulta → **GET /rutas/:id/dia/trayectorias**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `trayectorias-reporte.e2e-spec.ts`, 5 tests).
- Archivos modificados:
  - `src/domain/trayectorias.ts` (+spec) — `ParadaGeoJSON`, `trayectoriasAGeoJSON`.
  - `src/modules/rutas/reporte-diario.entity.ts` (nuevo) — tabla `reportes_diarios` (PRD 4.2:320).
  - `src/modules/rutas/trayectorias.service.ts` (+spec) — `registrarReal`, `generarReporteDiario`, `consultar`.
  - `src/modules/rutas/dto/registrar-trayectoria-real.dto.ts` (nuevo) — `puntos` con `PuntoGeoDto`.
  - `src/modules/rutas/rutas.controller.ts` (+spec) — `POST .../trayectoria-real` y `GET .../trayectorias` gated por `ver_reportes`.
  - `src/modules/rutas/rutas.module.ts` — registro de `ReporteDiario` + `TrayectoriasService`.
  - `test/e2e/trayectorias-reporte.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/trayectorias-reporte.md` (este archivo).
- Decisiones de implementación:
  - La trayectoria real se registra manualmente (array de puntos lat/lng, mínimo 2 — LineString GeoJSON) y se persiste como tipo `real` en `ruta_optimizada_log` con `waypoints_geojson` en GeoJSON LineString.
  - `generarReporteDiario` consolida en `trayectorias_json` un FeatureCollection convirtiendo el formato plano de `ruta_optimizada_log.orden_clientes_json` a GeoJSON LineString (planificada = `Trayecto[][]`, real = array de paradas), con `properties.origen` = `"planificada"|"real"` para distinguirlas (HU-38). Campos de cobrado/prestado/clientes sin poblar aún (HU-18 detallado, parcial).
- Revisión independiente (code-reviewer, 2026-08-19): inicialmente **RECHAZADO** → bloqueantes corregidos y re-verificado. Bloqueantes: (a) la planificada no se consolidaba (casteaba `waypoints_geojson` plano a FeatureCollection → `.features` undefined); ahora se convierte `orden_clientes_json` plano a GeoJSON con `trayectoriasAGeoJSON` y su `origen`; (b) sin test del contenido consolidado → se agregó test unitario y e2e que verifican features de planificada y real con su `origen`. Observaciones atendidas: `ArrayMinSize(2)` (LineString ≥2 posiciones), `properties.origen` para distinguir features, e2e de <2 puntos → 400. Nits documentados sin cambio: `ver_reportes` en POST (decisión, puede revisarse a `generar_reporte`), `fechaLocal` duplicado (backlog), `registrarReal` no transaccional (backlog), consolidación toma último log de cada tipo sin filtrar por día (pendiente).
- Pendientes/seguimiento:
  - Poblar `cobrado_dia`/`prestado_dia`/`clientes_visitados`/`clientes_sin_pago` del reporte diario (HU-18, detalle).
  - Tracking GPS en vivo (HU-44, condicionada).
  - Reporte diario con mapa renderizado en front.