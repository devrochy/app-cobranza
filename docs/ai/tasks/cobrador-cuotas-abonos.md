# Tarea: cobrador-cuotas-abonos (editar/eliminar cuotas y abonos desde la APK)

- **Origen:** Plan aprobado del usuario para dejar la APK desarrollada (Fase 3b, 2026-09-01). HU-48 (docs/APP_REQUIREMENTS.md:65): editar/eliminar cuotas y abonos con auditoría y re-autenticación.
- **Estado:** completada
- **Fecha inicio:** 2026-09-02
- **Fecha cierre:** 2026-09-02

## Objetivo
Exponer en `/cobrador` los endpoints de edición/eliminación de cuotas y abonos con `CobradorPermisoGuard` y re-autenticación del cobrador (HU-48), reutilizando `CuotaService`/`AbonosService` (que ya validan `assertOwned`, auditoría y caja).

## Fuera de alcance
- UI de la APK (tarea `apk-editar-eliminar-cuotas` en el repo app-cobranza-apk).

## Bloques (checklist TDD)
- [x] Bloque 1: `ReautenticacionService` — soporte de rol `cobrador` (consulta su hash) + registro de `Cobrador` en `SecurityModule`.
  - Test(s): `src/modules/security/reautenticacion.service.spec.ts` (3, nuevo archivo).
- [x] Bloque 2: `CobradorService` — `editarCuota`, `eliminarCuota`, `eliminarAbono` (delegación con contexto auditado).
  - Test(s): `src/modules/cobrador/cobrador.service.spec.ts` (+3).
- [x] Bloque 3: `CobradorController` — `PATCH/DELETE /cobrador/rutas/:rutaId/cuotas/:cuotaId` (permiso `eliminar_pago`) y `DELETE /cobrador/rutas/:rutaId/abonos/:abonoId` (permiso `eliminar_abono`); export `CuotaService` desde `CarteraModule`.
  - Test(s): `src/modules/cobrador/cobrador.controller.spec.ts` (+3).
- [x] Bloque 4: e2e — PATCH cuota 200 (re-auth), DELETE abono 200 (re-auth), 403 sin permiso.
  - Test(s): `test/e2e/cobrador-apk.e2e-spec.ts` (+4).

## Decisiones tomadas durante la implementación
- `ReautenticacionService` solo validaba admin/socio; se agregó la rama cobrador (el hash del cobrador ya existe en `cobrador_permisos`-repo: `Cobrador.passwordHash`).
- Permisos: cuotas → `eliminar_pago`, abonos → `eliminar_abono` (catálogo `COBRADOR_PERMISOS`).
- El e2e crea el abono vía admin (`POST /rutas/:rutaId/abonos`) porque el cobrador de prueba no tiene `registrar_abono`.
- `CarteraModule` ahora exporta `CuotaService` (faltaba para el wiring).

## Ambigüedades resueltas con el usuario
- (ninguna abierta)

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (811 tests, 95 suites) + e2e cobrador-apk (16 tests).
- Archivos modificados: `src/modules/security/reautenticacion.service.ts` (+spec, nuevo), `src/modules/security/security.module.ts` (registra Cobrador), `src/modules/cartera/cartera.module.ts` (exporta CuotaService), `src/modules/cobrador/cobrador.service.ts` (+3 métodos), `src/modules/cobrador/cobrador.service.spec.ts` (+3), `src/modules/cobrador/cobrador.controller.ts` (+3 endpoints), `src/modules/cobrador/cobrador.controller.spec.ts` (+3), `test/e2e/cobrador-apk.e2e-spec.ts` (+4).
- Pendientes/seguimiento: UI de la APK (`apk-editar-eliminar-cuotas`).