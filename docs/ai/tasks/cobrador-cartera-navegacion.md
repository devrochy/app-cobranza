# Tarea: cobrador-cartera-navegacion (lista de clientes + estado de cuenta APK)

- **Origen:** Petición directa del usuario 2026-09-02 (rediseño APK: lista de clientes de ruta + canvas de cuotas con abonos).
- **Estado:** completada
- **Fecha inicio:** 2026-09-02

## Objetivo
Exponer al cobrador (APK) los endpoints de lectura que faltan para la nueva navegación: lista completa de clientes de una ruta y estado de cuenta de un préstamo con abonos/saldo por cuota. Ampliar el seed para que el canvas de cuotas tenga estados variados (pagadas, en mora, cuota actual, futuras, abono parcial).

## Fuera de alcance
- Endpoints de escritura nuevos para el cobrador (ya existen visitas/prestamos/cuotas/abonos).
- Exponer historial de abonos individuales (los abonos se imputan FIFO por préstamo; se expone el agregado por cuota en estado de cuenta).

## Bloques (checklist TDD)
- [x] Bloque 1: `GET /cobrador/rutas/:rutaId/clientes` → lista completa de clientes de la ruta (permiso `ver_cartera`, ownership cobrador).
  - Test(s): e2e en `test/e2e/cobrador-apk.e2e-spec.ts` (200 con clientes; 403 ruta ajena).
- [x] Bloque 2: `GET /cobrador/rutas/:rutaId/prestamos/:prestamoId/estado-cuenta` → estado de cuenta con `abonosAcumulados`/`saldoPendiente` por cuota (permiso `ver_cartera`).
  - Test(s): e2e (200 con cuotas y saldos; 403 ruta ajena).
- [x] Bloque 3: Seed `test-data.seed.service.ts` — agregar un abono parcial a una cuota de un préstamo vigente para que el canvas muestre abono a cuota.
  - Test(s): unit en `test-data.seed.service.spec.ts` (`registrarAbono` con FIFO); e2e de estado de cuenta con abono.
- [x] Bloque 4: Seed — habilitar permisos APK de operación (registrar_prestamo, registrar_abono, etc.) y re-siembra idempotente de cartera si el socio existe sin préstamos.
  - Test(s): `test-data.seed.service.spec.ts` (3 tests nuevos: permisos habilitados, re-siembra, no duplica).

## Decisiones tomadas durante la implementación
- Reutilizar `ClienteService.listar` y `EstadoCuentaService.obtener` (ambos ya validan ownership con `assertOwned`, que soporta rol cobrador).
- Exportar `EstadoCuentaService` desde `CarteraModule` para poder inyectarlo en `CobradorService`.

## Ambigüedades resueltas con el usuario
- Pregunta: la lista de clientes de ruta y abonos por cuota no existen como endpoint cobrador → **agregar endpoints al backend**.
- Pregunta: datos de prueba → **ampliar seed si hace falta**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 823 tests) + `npm run test:e2e` (53 suites, 380 tests).
- Archivos modificados:
  - `src/modules/cobrador/cobrador.controller.ts` — `GET rutas/:rutaId/clientes` y `GET rutas/:rutaId/prestamos/:prestamoId/estado-cuenta` (permiso `ver_cartera`).
  - `src/modules/cobrador/cobrador.service.ts` — `listarClientesDeRuta`, `obtenerEstadoCuentaPrestamo` (delegación).
  - `src/modules/cobrador/cobrador.service.spec.ts` — mocks nuevos + 2 tests de delegación.
  - `src/modules/cartera/cartera.module.ts` — exportar `EstadoCuentaService`.
  - `src/modules/test-data/test-data.seed.service.ts` — `PERMISOS_APK` habilitados, `sembrarPrestamosYPagos`, `sincronizarDataDePrueba` (re-siembra idempotente).
  - `src/modules/test-data/test-data.module.ts` — repos `Socio`, `Cobrador`, `Ruta`, `Cuota`, `Prestamo`.
  - `src/modules/test-data/test-data.seed.service.spec.ts` — mocks + 3 tests nuevos.
  - `test/e2e/cobrador-apk.e2e-spec.ts` — 4 tests nuevos (200/403 lista clientes, 200/403 estado de cuenta).
  - `docs/ai/tasks/cobrador-cartera-navegacion.md` (este archivo).
- Pendientes/seguimiento: la APK consumirá estos endpoints en `app-cobranza-apk` (tarea `apk-financial-ux-navegacion`). Permisos APK de operación habilitados para que el cobrador pueda registrar préstamos/pagos en la APK.