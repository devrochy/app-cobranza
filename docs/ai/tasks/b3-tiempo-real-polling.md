# Tarea: B3 — HU-44 tiempo real por polling (posición cobrador + posiciones panel)

- **Origen:** Plan consolidado aprobado por el usuario 2026-09-02 (Epic B3) + decisión "polling HTTP".
- **Estado:** completada
- **Fecha inicio:** 2026-09-02

## Objetivo
MVP de tiempo real (HU-44) por polling: la APK envía la posición del cobrador periódicamente y el panel consulta las posiciones para el mapa en vivo.

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad `posicion_cobrador` (única por cobrador+ruta) + `PosicionCobradorService` (registrar upsert, ultimasDelSocio) — unit 4 tests.
- [x] Bloque 2: `POST /cobrador/rutas/:rutaId/posicion` (permiso ver_cartera, ownership) — e2e 1 test.
- [x] Bloque 3: `GET /rutas/posiciones` (ver_reportes) para el panel — e2e 1 test.
- [x] Verificación: `scripts/check.sh` (831 tests) + `npm run test:e2e` (53 suites, 386 tests).

## Resultado final
- Comandos: `scripts/check.sh` + `npm run test:e2e`.
- Archivos:
  - `src/modules/rutas/posicion-cobrador.entity.ts` (+service +spec)
  - `src/modules/rutas/posicion-cobrador.service.ts` / `.spec.ts`
  - `src/modules/rutas/dto/registrar-posicion.dto.ts`
  - `src/modules/rutas/rutas.module.ts` (registro)
  - `src/modules/rutas/rutas.controller.ts` (+spec) — `GET /rutas/posiciones`
  - `src/modules/cobrador/cobrador.controller.ts` / `.service.ts` (+specs) — `POST .../posicion`
  - `test/e2e/cobrador-apk.e2e-spec.ts`, `test/e2e/rutas.e2e-spec.ts`
  - `docs/ai/tasks/b3-tiempo-real-polling.md`
- Pendientes: A7 (envío periódico en la APK), C2/C3 (vistas del panel).