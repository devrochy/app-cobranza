# ADR-0002: Coordenadas geográficas con PostGIS (geography(Point))

- **Estado:** aceptada
- **Fecha:** 2026-08-17

## Contexto

`docs/APP_REQUIREMENTS.md` (sección 4.3) recomienda usar el tipo `geography(Point)` de PostGIS en lugar de `latitud`/`longitud` planos para habilitar cálculos de distancia y las consultas de optimización de ruta de forma nativa. Actualmente el modelo usa `latitud`/`longitud` (float) en `clientes` y `prestamos`. La Épica 7 (segmentación de trayectos, distancias, orden por vecino más cercano) y la futura georreferenciación del cobrador (HU-35 a 44, 55 a 59) dependen de poder calcular distancias sobre las coordenadas.

## Decisión

Migrar las coordenadas de las entidades geográficas al tipo **`geography(Point)`** de PostGIS, de forma que el backend pueda calcular distancias con consultas nativas (ST_Distance, ST_DWithin, etc.) y la segmentación de trayectos no dependa de una API externa de mapas en el MVP.

## Justificación

1. **Cálculo nativo de distancia**: `geography` calcula distancias en metros sobre el elipsoide (WGS84), necesario para clustering por cercanía y orden por vecino más cercano (HU-55).
2. **Sin API externa en el MVP**: el PRD Fase 1 no integra Google Maps/OSRM; con PostGIS el trazado óptimo se calcula internamente sobre coordenadas de prueba.
3. **Preparado para el futuro**: la ubicación en vivo del cobrador (HU-44, opcional) y la trayectoria real (HU-49) consumirán el mismo tipo de dato.
4. **docker-compose ya usa `postgis/postgis`**: la infraestructura local está lista; solo falta usar el tipo en el modelo.

## Alternativas consideradas

- **Mantener lat/lng planos y calcular con haversine en JS**: viable y simple, pero la lógica quedaría en el código de la aplicación en lugar de la BD, y degradaría el rendimiento al crecer la cartera.
- **Google Maps/OSRM para distancias**: se descarta para el MVP (Fase 1 sin APIs externas de pago); se conecta en Fase 2 (PRD 6.1) solo para la generación del enlace de navegación y rutas sobre calles.

## Consecuencias

- **Entidades afectadas**: `clientes` (lat/lng del negocio y, al agregarse, del domicilio), `prestamos` (se elimina su lat/lng propio al pasar a usar la ubicación del negocio del cliente, HU-14) y futuras tablas de trayectoria (`ruta_optimizada_log.waypoints_geojson`, `visitas`).
- **TypeORM**: las columnas se modelan como `geography(Point)`; los valores en los DTOs se siguen recibiendo como `{ lat, lng }`/`{ latitud, longitud }` y se convierten a `Point` al persistir.
- **Migración**: requiere un paso de migración de datos (convertir lat/lng existentes a `geography(Point)`). Se ejecuta en Fase 0 (cimientos) antes de la Épica 7.
- **Índices espaciales**: crear índices GIST sobre las columnas `geography` para las consultas de distancia.
- **Actualizar**: `docs/APP_REQUIREMENTS.md` 4.2 (tipos de columnas) y el backlog de PostGIS al implementarse.
