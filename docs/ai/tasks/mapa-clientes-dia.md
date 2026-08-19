# Tarea: Mapa de clientes desde la lista del día (HU-57)

- **Origen:** Roadmap Fase 3 ítem 19 (docs/plan-feature-roadmap.md:43) — HU-57 (docs/APP_REQUIREMENTS.md:107).
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Endpoint `GET /rutas/:id/dia/mapa` (gated `ver_reportes`) que devuelve los markers de los clientes de la lista del día (misma base que HU-56/ítem 18) con coordenadas de negocio y domicilio.

## Fuera de alcance
- Renderizado del mapa (componente front/panel) — el endpoint solo provee markers/datos.
- Enlaces de navegación Google Maps/Waze → HU-59 (ítem 21).
- Tarjeta de cliente completa (foto, saldo, mora) → HU-58 (ítem 20).
- Tracking GPS en vivo (HU-44, condicionada).

## Decisiones tomadas durante la implementación
- Mapa sobre la lista del día (HU-56) + coordenadas.
- Endpoint `GET /rutas/:id/dia/mapa` (gated `ver_reportes`).
- Ambos markers por cliente (negocio + domicilio), flag para distinguirlos.
- Coordenadas del geography del cliente (ST_Y/ST_X con casteo a geometry).

## Bloques (checklist TDD)
- [x] Bloque 0: `ListaClientesDelDiaService.obtenerMapa` — reutiliza `obtener` (lista del día) + `coordenadasDeClientes` (geography negocio/domicilio). 2 tests unitarios nuevos (total 6).
- [x] Bloque 1: Endpoint `GET /rutas/:id/dia/mapa` (ver_reportes) + e2e (4 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: fuente → **lista del día (HU-56) + coordenadas**.
- Pregunta: endpoint → **GET /rutas/:id/dia/mapa**.
- Pregunta: markers → **ambos (negocio + domicilio), con flag**.
- Pregunta: coordenadas → **geography del cliente (ST_Y/ST_X + casteo geometry)**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `mapa-clientes-dia.e2e-spec.ts`, 4 tests).
- Archivos modificados:
  - `src/modules/rutas/lista-clientes-dia.service.ts` (+spec) — `obtenerMapa`, `MarkerClientePublic`, `coordenadasDeClientes`.
  - `src/modules/rutas/rutas.controller.ts` (+spec) — `GET /rutas/:id/dia/mapa` gated por `ver_reportes`.
  - `test/e2e/mapa-clientes-dia.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/mapa-clientes-dia.md` (este archivo).
- Decisiones de implementación:
  - El mapa reutiliza la lista del día (HU-56) y añade las coordenadas leídas del geography del cliente (negocio + domicilio opcional), con `tipo: negocio|domicilio` y `color`/`enTrayecto`.
  - Un cliente sin domicilio genera solo el marker de negocio.
- Revisión independiente (code-reviewer, 2026-08-19): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Observaciones (nits, sin cambio): (a) `coordenadasDeClientes` duplica el patrón SQL ST_Y/ST_X de `ruta-optimizacion.service.ts` — registrar en backlog la posible extracción de un helper compartido en `src/common/geo.ts`; (b) sin test explícito de cliente bloqueado excluido del mapa ni del `if (!c) continue` (cubierto implícitamente por e2e); (c) la query SQL de coordenadas solo se valida vía e2e (consistente con HU-56).
- Pendientes/seguimiento:
  - Renderizado del mapa en front/panel (no en el backend).
  - Enlaces de navegación Google Maps/Waze → HU-59 (ítem 21).
  - Tarjeta de cliente completa → HU-58 (ítem 20).
  - Posible helper compartido de extracción de coordenadas geography (backlog).