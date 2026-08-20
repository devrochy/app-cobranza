# Tarea: Segmentación de la ruta del día en trayectos (HU-55)

- **Origen:** Roadmap Fase 3 ítem 17 (docs/plan-feature-roadmap.md:41) — HU-55 (docs/APP_REQUIREMENTS.md:105), amplía HU-35/36. Tabla `ruta_optimizada_log` PRD 4.2:344.
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Segmentar la ruta del día en trayectos de hasta 9 paradas (clientes a visitar) con clustering geográfico (K-means) y orden por vecino más cercano, persistiendo en `RutaOptimizadaLog` (tipo `planificada`). Solo segmentación inicial (HU-35); el recálculo dinámico (HU-36) va a un ítem posterior.

## Fuera de alcance
- Recálculo dinámico por eventos (HU-36) — ítem posterior (requiere simulador WhatsApp + lista del día).
- Lista de clientes del día con colores (HU-56 → ítem 18).
- Enlaces de navegación Google Maps/Waze (HU-37/59 → ítem 21).
- Persistencia de trayectoria real recorrida y reporte diario con GeoJSON (HU-49 → ítem 22).
- Tracking GPS en vivo (HU-44, condicionada).

## Decisiones tomadas durante la implementación
- Persistir trayectos en `RutaOptimizadaLog` (tipo `planificada`).
- Clientes del día = con deuda pendiente (préstamos vigentes con cuotas pendientes/atrasadas).
- Algoritmo: K-means (grupos ≤ 9) + orden por vecino más cercano.
- Distancias con `ST_Distance` de PostGIS.
- Endpoints: `POST /rutas/:id/dia/trayectos` (generar, `generar_reporte`) y `GET /rutas/:id/dia/trayectos` (consultar, `ver_reportes`).

## Bloques (checklist TDD)
- [x] Bloque 0: Función pura `segmentarTrayectos` (K-means ≤9 + vecino más cercano) y `calcularDistanciaKm` (haversine) en `src/domain/segmentacion-trayectos.ts`. 7 tests.
- [x] Bloque 1: Entidad `RutaOptimizadaLog` (PRD 4.2:344) + registro en módulo.
- [x] Bloque 2: `RutaOptimizacionService` — clientes del día (deuda pendiente), segmentación, persistencia `planificada`, consulta. 6 tests unitarios.
- [x] Bloque 3: Endpoints `POST /rutas/:id/dia/trayectos` (generar_reporte) y `GET /rutas/:id/dia/trayectos` (ver_reportes) + e2e (5 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: persistencia → **RutaOptimizadaLog** (tipo planificada).
- Pregunta: selección del día → **clientes con deuda pendiente**.
- Pregunta: algoritmo → **K-means + vecino más cercano**.
- Pregunta: distancias → **ST_Distance de PostGIS**.
- Pregunta: alcance → **solo segmentación inicial (HU-35)**.
- Pregunta: endpoints → **POST generar + GET consultar** (generar_reporte / ver_reportes).

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `segmentacion-trayectos.e2e-spec.ts`, 5 tests).
- Archivos modificados:
  - `src/domain/segmentacion-trayectos.ts` (+spec) — `ParadaGeo`, `calcularDistanciaKm` (haversine), `segmentarTrayectos` (K-means ≤9 + vecino más cercano).
  - `src/modules/rutas/ruta-optimizada-log.entity.ts` (nuevo) — tabla `ruta_optimizada_log` (PRD 4.2:344).
  - `src/modules/rutas/ruta-optimizacion.service.ts` (+spec) — `generar`, `consultar`, `obtenerClientesDelDia` (clientes con deuda, coordenadas via `ubicacion::geometry`).
  - `src/modules/rutas/rutas.controller.ts` (+spec) — `POST/GET /rutas/:id/dia/trayectos`.
  - `src/modules/rutas/rutas.module.ts` — registro.
  - `test/e2e/segmentacion-trayectos.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/segmentacion-trayectos.md` (este archivo).
- Decisiones de implementación:
  - Distancias de clustering/orden calculadas en memoria con **haversine** (determinista y testeable); las coordenadas se leen de la BD con `ST_Y/ST_X(ubicacion::geometry)`. `ST_Distance` queda disponible para consultas geoespaciales que lo requieran (desviación documentada del enfoque).
  - `tiempo_estimado_min` = distancia_estimada_km / 20 km/h (velocidad urbana asumida).
  - `waypoints_geojson` y `orden_clientes_json` guardan el mismo array de trayectos por ahora (sin formato GeoJSON estricto aún; se refina en HU-49/ítem 22).
  - Los clientes del día filtran `c.estatus='activo'` además de la deuda pendiente.
- Revisión independiente (code-reviewer, 2026-08-19): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) `consultar` con tiebreaker `order: { fecha: DESC, id: DESC }` para regeneraciones del mismo día; (b) filtro `c.estatus='activo'` en clientes del día; (c) e2e ahora incluye un cliente sin deuda y verifica que no aparece en los trayectos; (d) test de "ancla determinista" corregido para afirmar el punto de menor latitud+longitud; (e) guard `maxParadas <= 0` en `segmentarTrayectos` (evita recursión infinita). Nits documentados sin cambio: NaN teórico en haversine (puntos casi antípodas), sin índice en `ruta_optimizada_log(ruta_id,tipo,fecha)` (irrelevante en MVP).
- Pendientes/seguimiento:
  - Recálculo dinámico (HU-36) — ítem posterior (requiere simulador WhatsApp + lista del día).
  - Lista de clientes del día con colores (HU-56 → ítem 18).
  - Persistir trayectoria real y GeoJSON estricto en reporte diario (HU-49 → ítem 22).
  - Velocidad media de 20 km/h asumida para tiempo estimado (validar con dato real en Fase 2).
  - Índice en `ruta_optimizada_log(ruta_id, tipo, fecha)` si el volumen de regeneraciones crece.