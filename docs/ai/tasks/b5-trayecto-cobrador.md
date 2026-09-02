# Tarea: B5 — Generar trayecto del día desde la APK

- **Origen:** Plan consolidado aprobado por el usuario 2026-09-02 (Epic B5) + decisión "generar desde la APK".
- **Estado:** completada
- **Fecha inicio:** 2026-09-02

## Objetivo
Endpoint `POST /cobrador/rutas/:rutaId/trayecto` (permiso `ver_cartera`, ownership cobrador) que genera el trayecto planificado del día reutilizando `RutaOptimizacionService.generar`. Permite que la APK cree el trayecto si no existe (gating de la lista del día).

## Fuera de alcance
- Recálculo dinámico por eventos (HU-36) — backlog.
- Vista de trayectos en el panel (ya existe).

## Bloques (checklist TDD)
- [x] Bloque 1: `CobradorService.generarTrayecto` delega en `RutaOptimizacionService.generar` (unit 1 test).
- [x] Bloque 2: Endpoint `POST /cobrador/rutas/:rutaId/trayecto` (e2e 2 tests: 201 + trayectos en dia, 403 ruta ajena).

## Resultado final
- Comandos ejecutados: `scripts/check.sh` (824 tests) + `npm run test:e2e -- cobrador-apk` (24 tests).
- Archivos modificados: `src/modules/cobrador/cobrador.controller.ts`, `src/modules/cobrador/cobrador.service.ts`, `src/modules/cobrador/cobrador.service.spec.ts`, `test/e2e/cobrador-apk.e2e-spec.ts`, `docs/ai/tasks/b5-trayecto-cobrador.md`.
- Pendientes: reiniciar backend live para exponer el endpoint.