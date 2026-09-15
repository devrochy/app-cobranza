---
estado: completada
tags: [tarea]
---

# Tarea: P2 — Edición de ruta desde la APK (backend)

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P2**; ítem del backlog APK "Edición de ruta desde la APK (solo lectura)". Decisión del usuario: el cobrador puede editar **nombre + interés + cuotas** de su ruta asignada.
- **Estado:** completada
- **Fecha inicio:** 2026-09-12

## Objetivo
Permitir que el cobrador edite la metadata (nombre/descripción) y la configuración (tipoInteres/numCuotas) de su ruta asignada, con el permiso `actualizar_ruta` y ownership.

## Bloques (checklist TDD)
- [x] Bloque 1: `actualizar_ruta` en `COBRADOR_PERMISOS`.
- [x] Bloque 2: `CobradorService.actualizarRuta`/`actualizarConfiguracionRuta` delegan en `RutasService` (con ownership).
  - Test(s): `src/modules/cobrador/cobrador.service.spec.ts`
- [x] Bloque 3: `PATCH /cobrador/rutas/:rutaId` y `PATCH /cobrador/rutas/:rutaId/configuracion` con `@CobradorPermisoRequerido("actualizar_ruta")`.
  - Test(s): `src/modules/cobrador/cobrador.controller.spec.ts`, `test/e2e/cobrador-apk.e2e-spec.ts`

## Decisiones tomadas durante la implementación
- Se reutilizan `UpdateRutaDto`/`UpdateRutaConfigDto` y `RutasService.actualizarInformacion`/`actualizarConfiguracion` (ya aplican `assertOwned`).
- El ownership del cobrador lo resuelve `assertOwned` (`ruta.cobradorId`).

## Ambigüedades resueltas con el usuario
- Alcance: nombre/interés/cuotas (no la config completa ni la moneda).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (110 suites, 992 tests) + `npm run test:e2e` (58 suites, 425 tests) → verde.
- Archivos modificados:
  - `src/modules/cobradores/cobrador-permiso.entity.ts` — `actualizar_ruta`.
  - `src/modules/cobrador/cobrador.service.ts` (+ `.spec.ts`) — delegación a `RutasService`.
  - `src/modules/cobrador/cobrador.controller.ts` — 2 endpoints.
  - `test/e2e/cobrador-apk.e2e-spec.ts` — 4 tests (200 nombre, 200 config, 403 sin permiso, 403 ownership).
- Pendientes/seguimiento: la APK consume los endpoints (PR aparte); el panel expone el permiso en la matriz.