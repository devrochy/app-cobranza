# Tarea: A1-backend — mis-rutas expone tipoInteres y numCuotas de la ruta

- **Origen:** Plan consolidado aprobado por el usuario 2026-09-02 (Epic A1 — autocompletar préstamo en la APK).
- **Estado:** completada
- **Fecha inicio:** 2026-09-02

## Objetivo
`GET /cobrador/mis-rutas` incluye `tipoInteres` y `numCuotas` de la ruta para que la APK pueda autocompletar el formulario de nuevo préstamo.

## Bloques (checklist TDD)
- [x] Bloque 1: `RutaApkPublic` con `tipoInteres`/`numCuotas`; `misRutas` los propaga (unit 1 test).
- [x] Verificación: `scripts/check.sh` verde (826 tests).

## Resultado final
- Comandos: `scripts/check.sh` (826 tests).
- Archivos: `src/modules/cobrador/cobrador.service.ts`, `src/modules/cobrador/cobrador.service.spec.ts`, `docs/ai/tasks/a1-backend-mis-rutas-defaults.md`.
- Pendientes: PR a develop; la APK consumirá estos campos en `ClienteScreen` (A1).