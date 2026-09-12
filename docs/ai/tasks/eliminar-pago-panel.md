---
estado: en progreso
tags: [tarea]
---

# Tarea: Eliminar pago de cuota desde el panel (backend)

- **Origen:** Petición directa del usuario (2026-09-12) — hoy solo la APK del cobrador puede borrar pagos (`DELETE /cobrador/...`); el panel (admin/socio) no. Decisión del usuario: permiso socio nuevo `eliminar_pago`.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-12

## Objetivo
Exponer `DELETE /rutas/:rutaId/pagos/:pagoId` para admin/socio con el permiso `eliminar_pago`, y devolver el pago por cuota en el estado de cuenta para que el panel ofrezca el borrado.

## Fuera de alcance
- UI del panel (otro PR).
- APK.

## Bloques (checklist TDD)
- [x] Bloque 1: `eliminar_pago` en `SOCIO_PERMISOS`.
  - Test(s): `src/modules/socios/socio-permiso.entity.ts` (descriptor; cubierto por permisos-socio.spec)
- [x] Bloque 2: `DELETE /rutas/:rutaId/pagos/:pagoId` en `cartera.controller.ts` (`@PermisoRequerido("eliminar_pago")`) delegando a `PagosService.eliminarPago`.
  - Test(s): `src/modules/cartera/cartera.controller.spec.ts`
- [x] Bloque 3: `estado-cuenta` expone `pago` por cuota (`{ id, valor, fechaHora, liquidado } | null`).
  - Test(s): `src/domain/estado-cuenta-prestamo.spec.ts`, `src/modules/cartera/estado-cuenta.service.spec.ts`
- [x] Bloque 4: e2e de borrado de pago por admin/socio (200/403/400-liquidado).
  - Test(s): `test/e2e/gestion-cuotas-abonos.e2e-spec.ts`

## Decisiones tomadas durante la implementación
- El endpoint reutiliza `PagosService.eliminarPago` (ownership, re-auth, motivo y guarda de `liquidado` ya existentes).
- `estado-cuenta` pasa a recibir `pagos` y expone `pago` por cuota (contrato aditivo).
- `SOCIO_PERMISOS` es la fuente del catálogo; la matriz del panel lo toma vía `GET /socios/:id/permisos` (socios existentes quedan en `false` hasta guardar).

## Ambigüedades resueltas con el usuario
- Permiso: nuevo `eliminar_pago` (no reutilizar `borrar_ultima_cuota`).
- El `pagoId` se obtiene extendiendo `estado-cuenta` (no un endpoint nuevo de listado).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (109 suites, 986 tests) + `npm run test:e2e` (58 suites, 414 tests) → verde.
- Archivos modificados:
  - `src/modules/socios/socio-permiso.entity.ts` — `eliminar_pago` en `SOCIO_PERMISOS`.
  - `src/modules/cartera/cartera.controller.ts` (+ `.spec.ts`) — `DELETE /rutas/:rutaId/pagos/:pagoId` con `@PermisoRequerido("eliminar_pago")`.
  - `src/domain/estado-cuenta-prestamo.ts` (+ `.spec.ts`) — `pago` por cuota.
  - `src/modules/cartera/estado-cuenta.service.ts` (+ `.spec.ts`) — carga los pagos del préstamo.
  - `test/e2e/gestion-cuotas-abonos.e2e-spec.ts` — 3 tests (200 + reabre cuota, 400 liquidado, 403 sin permiso).
- Pendientes/seguimiento: UI del panel (PR aparte). La matriz del socio debe habilitar `eliminar_pago`.
