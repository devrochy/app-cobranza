# Tarea: cobrador-prestamos (endpoint POST /cobrador/rutas/:id/prestamos)

- **Origen:** Plan aprobado del usuario para dejar la APK desarrollada (Fase 3a, 2026-09-01). HU-14 (docs/APP_REQUIREMENTS.md:57): registrar préstamo desde la APK.
- **Estado:** completada
- **Fecha inicio:** 2026-09-02
- **Fecha cierre:** 2026-09-02

## Objetivo
Exponer `POST /cobrador/rutas/:rutaId/prestamos` con `CobradorPermisoGuard("registrar_prestamo")`, reutilizando `PrestamoService.crear` (cupo, tope de deuda, validaciones de `ruta_config`), para que la APK registre préstamos (HU-14).

## Fuera de alcance
- Pantalla de la APK (tarea `apk-registrar-prestamo` en el repo app-cobranza-apk).
- Fotos del cliente al crear préstamo (las maneja el alta de cliente, no el préstamo).

## Bloques (checklist TDD)
- [x] Bloque 1: `CobradorService.crearPrestamo(rutaId, input, requester, fechaOtorgado)` delega en `PrestamoService.crear`.
  - Test(s): `src/modules/cobrador/cobrador.service.spec.ts` (+2).
- [x] Bloque 2: `CobradorController` — `POST rutas/:rutaId/prestamos` con `@CobradorPermisoRequerido("registrar_prestamo")`; parsea `fechaOtorgado`.
  - Test(s): `src/modules/cobrador/cobrador.controller.spec.ts` (+1).
- [x] Bloque 3: e2e — 201 crea préstamo con cuotas; 403 sin permiso.
  - Test(s): `test/e2e/cobrador-apk.e2e-spec.ts` (+2).

## Decisiones tomadas durante la implementación
- `PrestamoService.crear` ya valida `assertOwned` por `ruta.cobradorId`, así que el requester cobrador pasa sin cambios de autorización.
- El permiso `registrar_prestamo` se habilitó en la matriz del cobrador de prueba del e2e (no se ejercitaba en ningún test previo).
- `fechaOtorgado` opcional (default hoy), consistente con el endpoint admin `POST /cartera/rutas/:rutaId/prestamos`.

## Ambigüedades resueltas con el usuario
- (ninguna abierta)

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (806 tests, 95 suites) + e2e cobrador-apk (12 tests).
- Archivos modificados: `src/modules/cobrador/cobrador.service.ts` (+crearPrestamo), `src/modules/cobrador/cobrador.service.spec.ts` (+2), `src/modules/cobrador/cobrador.controller.ts` (+endpoint), `src/modules/cobrador/cobrador.controller.spec.ts` (+1), `test/e2e/cobrador-apk.e2e-spec.ts` (+2).
- Pendientes/seguimiento: pantalla de la APK (`apk-registrar-prestamo`).