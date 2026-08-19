# Tarea: Migración de coordenadas a PostGIS (geography(Point))

- **Origen:** Roadmap Fase 0 ítem 4 (docs/plan-feature-roadmap.md:17) + ADR-0002 (docs/ai/decisions/0002-postgis-geografia.md)
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Reemplazar las columnas `latitud`/`longitud` (float) de `clientes` y `prestamos` por el tipo `geography(Point, 4326)` de PostGIS, con índice GIST, habilitando cálculo de distancias nativo (requisito de la Épica 7). En `prestamos` se ELIMINA su lat/lng propio (el préstamo usa la ubicación del negocio del cliente, HU-14), según decisión del usuario.

## Fuera de alcance
- Agregar la coordenada de domicilio del cliente (HU-14 ampliado) — tarea Fase 1 ítem 10.
- Calcular distancias/trazados (Épica 7) — tareas Fase 3.
- `visitas`, `ruta_optimizada_log` (trayectorias) — tablas futuras.

## Decisiones tomadas durante la implementación
- En `clientes` se conserva la columna `ubicacion` de tipo `geography(Point, 4326)`. El contrato de API (DTOs y `ClientePublic`) sigue exponiendo `latitud`/`longitud`; el servicio convierte a `Point` al persistir y de vuelta al leer.
- En `prestamos` se elimina `latitud`/`longitud` (entity, DTO, input, public) — la ubicación se resuelve desde el cliente.
- Se agrega helper compartido `src/common/geo.ts` (`toPoint`, `fromPoint`) para la conversión bidireccional lat/lng ↔ GeoJSON Point.

## Bloques (checklist TDD)
- [x] Bloque 1: Crear `src/common/geo.ts` con `toPoint(lat, lng)` y `fromPoint(point)`.
  - Test(s): `src/common/geo.spec.ts`
- [x] Bloque 2: Migrar `cliente.entity.ts` a columna `geography(Point)` con índice GIST; ajustar `cliente.service.ts` (persistir Point, exponer lat/lng).
  - Test(s): `src/modules/cartera/cliente.service.spec.ts`, `test/e2e/prestamos.e2e-spec.ts` (cliente)
- [x] Bloque 3: Eliminar `latitud`/`longitud` de `prestamo` (entity, DTO, input, public) y actualizar specs + e2e.
  - Test(s): `src/modules/cartera/prestamo.service.spec.ts`, `cartera.controller.spec.ts`, `test/e2e/prestamos.e2e-spec.ts`
- [x] Bloque 4: Actualizar `docs/APP_REQUIREMENTS.md` 4.2 y ADR-0002 (consecuencias) con el estado real.
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿qué hacer con `prestamos.lat/lng` en esta migración? → Respuesta: **eliminar** lat/lng de prestamos (el préstamo usa la ubicación del negocio del cliente).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + tests) y `npm run test:e2e` (16 suites) en verde.
- Archivos modificados: `src/common/geo.ts` (+spec), `src/modules/cartera/cliente.entity.ts`, `cliente.service.ts` (+spec), `prestamo.entity.ts`, `prestamo.service.ts` (+spec), `dto/create-prestamo.dto.ts`, `cartera.controller.spec.ts`, `test/e2e/prestamos.e2e-spec.ts`, `docs/APP_REQUIREMENTS.md`, `docs/ai/decisions/0002-postgis-geografia.md`, `docs/ai/tasks/postgis-migracion.md`.
- **Revisión final (code-reviewer, 2026-08-17):** APROBADO CON OBSERVACIONES (sin bloqueantes). Se cerró la brecha de round-trip de lectura real agregando aserción en el e2e (`res.body.latitud`/`longitud` del cliente creado, que se lee desde PostGIS) y se renombró el test engañoso de `geo.spec.ts`. Observaciones restantes (preexistentes/no bloqueantes) quedan en backlog: validación de rango lat/lng en DTOs y guard defensivo en `fromPoint`.
- Pendientes/seguimiento: coordenada de domicilio del cliente (HU-14 ampliado, Fase 1 ítem 10); tablas de trayectoria `visitas`/`ruta_optimizada_log` (Fase 3); cálculo de distancias (Épica 7). Cierra el ítem 4 de Fase 0 del roadmap.
