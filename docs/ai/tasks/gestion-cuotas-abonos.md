# Tarea: Gestión de cuotas y abonos con auditoría imborrable y re-autenticación (HU-48)

- **Origen:** Roadmap Fase 1 ítem 12 (docs/plan-feature-roadmap.md:30) — HU-48 (docs/APP_REQUIREMENTS.md:65). Tabla PRD 4.2:329 (auditoria_cartera).
- **Estado:** completada
- **Fecha inicio:** 2026-08-18

## Objetivo
Editar/eliminar cuotas (incluyendo pagadas) y eliminar abonos, registrando cada operación en `auditoria_cartera` (valores antes/después, actor, motivo, timestamp) y exigiendo re-autenticación de contraseña del operador en el body.

## Fuera de alcance
- Editar/eliminar pagos (HU-48 los menciona en la tabla auditoria, pero se difieren a un ítem futuro).
- Liquidación (HU-20, ítem 14).
- Notificaciones al cliente por cambios de cuotas (Fase 4).
- Login del cobrador y su invocación real de estas operaciones.

## Decisiones tomadas durante la implementación
- Re-auth: **password en body** de la operación; se verifica contra el hash del actor (admin/socio; cobrador futuro) vía `PasswordService`.
- Eliminar cuota pagada: **permitir y revertir caja** (`-valor`).
- Editar cuota pagada: **permitir y ajustar caja por diferencia**.
- Alcance: **cuotas (editar/eliminar) + abonos (eliminar)**.
- Permisos: **`borrar_ultima_cuota`** (editar/eliminar cuotas) y **`eliminar_abono`** (eliminar abonos).
- Borrado cuota: **físico + auditoría**.
- Borrado abono: **físico + revertir caja**.
- Pago asociado al eliminar cuota pagada: **dejar `pagos.cuota_id` nulo** (cambio de FK a nullable).

## Bloques (checklist TDD)
- [x] Bloque 0: Entidad `AuditoriaCartera` (PRD 4.2:329) + registro en módulo.
- [x] Bloque 1: Cambiar `pagos.cuota_id` a nullable (entity + FK en BD).
- [x] Bloque 2: `CuotaService` — `editarCuota` (validaciones, re-auth, auditoría, ajuste caja por diferencia si pagada) y `eliminarCuota` (físico + auditoría + revertir caja + pago con cuota_id nulo si pagada). Permiso `borrar_ultima_cuota`.
- [x] Bloque 3: `AbonosService.eliminarAbono` — físico + auditoría + revertir caja. Permiso `eliminar_abono`.
- [x] Bloque 4: Endpoints PATCH/DELETE de cuotas y DELETE de abono; e2e.
- Verificación: `scripts/check.sh` (37 suites / 337 tests) + `npm run test:e2e` (23 suites / 182 tests) — OK.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿re-auth? → **password en body**.
- Pregunta: ¿eliminar cuota pagada? → **permitir y revertir caja**.
- Pregunta: ¿editar cuota pagada? → **permitir y ajustar caja por diferencia**.
- Pregunta: ¿alcance? → **cuotas (editar/eliminar) + abonos (eliminar)**.
- Pregunta: ¿permisos? → **borrar_ultima_cuota + eliminar_abono**.
- Pregunta: ¿borrado cuota? → **físico + auditoría**.
- Pregunta: ¿borrado abono? → **físico + revertir caja**.
- Pregunta: ¿pago asociado? → **cuota_id nulo**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + 37 suites / 337 tests unitarios OK.
  - `npm run test:e2e` → 23 suites / 182 tests OK (incluye `gestion-cuotas-abonos.e2e-spec.ts`, 8 tests).
- Archivos modificados:
  - `src/modules/cartera/auditoria-cartera.entity.ts` (nuevo) — entidad `auditoria_cartera` (PRD 4.2:329).
  - `src/modules/cartera/cartera.module.ts` — registro de `AuditoriaCartera` + `CuotaService`.
  - `src/modules/cartera/pago.entity.ts` — `pagos.cuota_id` nullable con `onDelete: SET NULL` (HU-48).
  - `src/modules/cartera/cuota.service.ts` (+spec) — `editarCuota`/`eliminarCuota` con re-auth, auditoría, ajuste/reversión de caja y sincronización de `pago.valor` al editar cuota pagada.
  - `src/modules/cartera/abonos.service.ts` (+spec) — `eliminarAbono` con re-auth, auditoría y reversión de caja.
  - `src/modules/cartera/cartera.controller.ts` (+spec) — `PATCH /rutas/:id/cuotas/:cuotaId`, `DELETE /rutas/:id/cuotas/:cuotaId`, `DELETE /rutas/:id/abonos/:abonoId`, gated por `borrar_ultima_cuota`/`eliminar_abono`.
  - `src/modules/cartera/dto/operacion-auditada.dto.ts`, `editar-cuota.dto.ts` (nuevos).
  - `src/modules/security/reautenticacion.service.ts` (+módulo) — re-auth de password (admin/socio) reutilizada por cuota y abono.
  - `src/modules/cartera/pagos.service.ts` — `PagoPublic.cuotaId` ahora `number | null`.
  - `test/e2e/gestion-cuotas-abonos.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/backlog.md` — 2 entradas nuevas (visita tras eliminar abono; pago/edición cuota pagada resuelto).
- Revisión independiente (code-reviewer, 2026-08-18): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Observaciones atendidas: (a) al editar una cuota pagada se actualiza también `pago.valor` para mantener coherencia caja/pago (decisión: el pago refleja el valor corregido, no el histórico); (b) skip del ajuste de caja cuando `delta === 0`; (c) eliminada variable redundante `rutaIdEfectiva`. Observación documentada en backlog: la visita conserva `resultado: "pago"` tras eliminar el abono asociado.
- Pendientes/seguimiento:
  - Editar/eliminar **pagos** con auditoría (HU-48 los menciona en la tabla; diferido).
  - Login del cobrador para que sus permisos (`eliminar_abono`) sean alcanzables (hoy inalcanzable por PermisoGuard).
  - Préstamo tras eliminar cuota: no se regenera numeración; la liquidación (HU-20, ítem 14) debe contemplar que la suma de cuotas restantes difiere del valor original.
  - El e2e no verifica la edición de cuota pagada con ajuste de caja por diferencia (cubierto en unit test); se deja así por brevedad.
