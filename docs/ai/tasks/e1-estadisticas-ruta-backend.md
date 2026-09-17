---
estado: completada
tags: [tarea]
---

# Tarea: E1-backend — estadísticas por ruta con snapshot diario

- **Origen:** Bloque E del plan de analítica (aprobado por el usuario 2026-09-17). Requerimiento `REQ-BE` de estadísticas por ruta.
- **Estado:** completada
- **Fecha inicio:** 2026-09-17

## Objetivo
Exponer `GET /rutas/:id/estadisticas` con los conteos operativos de la ruta
(actual vs. día anterior) y persistir un snapshot diario que haga robusta la
comparación.

## Decisiones
- `clientesAtrasados` = clientes con `colorRiesgo = rojo`.
- `clientesVencidos` = clientes con al menos una cuota `atrasada`.
- `anterior` = snapshot de **ayer**; si el job no corrió, el último snapshot previo.
- Snapshot a fin del día local (`@Cron("0 55 23 * * *")`).
- Sin migraciones formales (carril D pendiente): `docs/ddl/ruta_estadisticas_snapshot.sql` + `synchronize` en dev.

## Bloques (checklist TDD)
- [x] Bloque 1: `domain/estadisticas-ruta.ts` (conteos, deltas) + spec.
- [x] Bloque 2: entidad `RutaEstadisticasSnapshot` + DDL.
- [x] Bloque 3: `EstadisticasRutaService` (`calcular`, `persistirSnapshot`, `obtener` con fallback) + spec.
- [x] Bloque 4: `EstadisticasRutaJobService` (cron de cierre) y endpoint en `RutasController`.
- [x] Verificación: `eslint`, `tsc --noEmit`, unit (10) y e2e (5) verdes.

## Resultado final
- Endpoint `GET /rutas/:id/estadisticas` (permiso `ver_reportes`, ownership por socio).
- Endpoint `GET /cobrador/rutas/:rutaId/estadisticas` (permiso `ver_cartera`, ownership por cobrador) para el APK — bloque E3.
- Comandos: `npx eslint src test`, `npx tsc --noEmit`, `npx jest` (unit), `npx jest --config test/jest-e2e.config.js`.
