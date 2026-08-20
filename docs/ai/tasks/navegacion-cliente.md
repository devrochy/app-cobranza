# Tarea: Navegación al cliente con enlaces Google Maps/Waze (HU-59)

- **Origen:** Roadmap Fase 3 ítem 21 (docs/plan-feature-roadmap.md:45) — HU-59 (docs/APP_REQUIREMENTS.md:109), amplía HU-37.
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Endpoint `GET /rutas/:rutaId/clientes/:clienteId/navegacion?origenLat=&origenLng=` (gated `ver_reportes`) que genera los deep links de navegación a Google Maps y Waze desde la ubicación actual del cobrador (origen explícito) hasta la ubicación del negocio del cliente.

## Fuera de alcance
- Enlace con el orden estricto de la ruta completa (HU-37) — punto-a-punto aquí (HU-59).
- Navegación al domicilio (decisión: solo negocio).
- API de pago de Google Maps (Directions/Distance Matrix) — Fase 2 (ADR-0002).
- Tracking GPS en vivo (HU-44, condicionada).
- Renderizado en front (el backend solo genera URLs).

## Decisiones tomadas durante la implementación
- Deep link sin API de pago (URL construida: Google Maps dir?api=1 + Waze ul?navigate).
- Origen explícito por parámetro (`origenLat`/`origenLng`).
- Destino = solo negocio del cliente.
- Endpoint `GET .../navegacion` (gated ver_reportes).

## Bloques (checklist TDD)
- [x] Bloque 0: Función pura `generarEnlacesNavegacion` en `src/domain/navegacion.ts` (googleMapsUrl dir?api=1 + wazeUrl ul?navigate). 2 tests.
- [x] Bloque 1: `NavegacionClienteService.obtener` — validar ruta/cliente, leer negocio, generar enlaces. 4 tests unitarios.
- [x] Bloque 2: Endpoint `GET /rutas/:rutaId/clientes/:clienteId/navegacion?origenLat=&origenLng=` (ver_reportes) + DTO `OrigenNavegacionDto` + e2e (6 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: generación → **deep link sin API de pago**.
- Pregunta: origen → **explícito por parámetro**.
- Pregunta: destino → **solo negocio**.
- Pregunta: exposición → **endpoint de navegación**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `navegacion-cliente.e2e-spec.ts`, 6 tests).
- Archivos modificados:
  - `src/domain/navegacion.ts` (+spec) — `CoordenadaGeo`, `EnlacesNavegacion`, `generarEnlacesNavegacion`.
  - `src/modules/cartera/navegacion-cliente.service.ts` (+spec) — `obtener`.
  - `src/modules/cartera/dto/origen-navegacion.dto.ts` (nuevo) — `origenLat`/`origenLng` con `@Type(() => Number)` (query params vienen como string).
  - `src/modules/cartera/cartera.controller.ts` (+spec) — `GET .../navegacion` gated por `ver_reportes`.
  - `src/modules/cartera/cartera.module.ts` — registro de `NavegacionClienteService`.
  - `test/e2e/navegacion-cliente.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/navegacion-cliente.md` (este archivo).
- Decisiones de implementación:
  - Google Maps: `https://www.google.com/maps/dir/?api=1&origin={lat},{lng}&destination={lat},{lng}` (formato lat,lng, alineado con la doc oficial de Maps URLs).
  - Waze: `https://www.waze.com/ul?ll={lat},{lng}&navigate=yes&from={lat},{lng}` (formato lat,lng).
  - Sin API de pago (deep links únicamente), coherente con ADR-0002.
  - `@Type(() => Number)` necesario porque los query params llegan como strings y `@IsNumber` los rechazaría.
- Revisión independiente (code-reviewer, 2026-08-19): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) orden de coordenadas de Google Maps alineado a `lat,lng` (doc oficial) en código y tests; (b) guarda defensiva `!cliente.ubicacion → 404`; (c) e2e de origen fuera de rango → 400. Nits documentados sin cambio: `fromPoint(null)` no alcanzable (columna NOT NULL), sin test unitario del DTO de rangos (cubierto por e2e).
- Pendientes/seguimiento:
  - Navegación al domicilio (decisión: solo negocio; se puede añadir después).
  - Enlace con orden estricto de la ruta completa (HU-37) — punto-a-punto aquí.
  - API de pago de Google Maps (Directions/Distance Matrix) — Fase 2 (ADR-0002).