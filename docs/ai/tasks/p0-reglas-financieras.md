---
estado: en progreso
tags: [tarea]
---

# Tarea: P0.2 — Reglas financieras (cuotas, abonos, topes)

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P0 Robustez+seguridad**; ítems del backlog: "`eliminarAbono` no valida liquidado", "Abono que iguala la deuda deja el préstamo vigente", "Liquidación: pagos huérfanos" y "Semántica del tope de deuda".
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-12

## Objetivo
Alinear las reglas financieras: no dejar pagos huérfanos, liquidar al saldar la deuda y comparar los topes con el saldo con interés.

## Bloques (checklist TDD)
- [x] Bloque 1: `AbonosService.eliminarAbono` rechaza abonos `liquidado` (400, igual que `eliminarPago`).
  - Test(s): `src/modules/cartera/abonos.service.spec.ts`
- [x] Bloque 2: prohibir borrar una cuota `pagada` (`eliminarCuota` → 400); `eliminarPago` reabre la cuota (`pendiente`) para que borrar el pago habilite el borrado de la cuota. Se elimina el desligue del pago y la reversión de caja en `eliminarCuota`.
  - Test(s): `src/modules/cartera/cuota.service.spec.ts`, `src/modules/cartera/pagos.service.spec.ts`
- [x] Bloque 3: al registrar un abono que iguala la deuda pendiente, el préstamo pasa a `liquidado` en la misma transacción.
  - Test(s): `src/modules/cartera/abonos.service.spec.ts`
- [x] Bloque 4: el cupo de ruta y el tope de deuda del cliente se comparan contra el **saldo con interés** (el nuevo préstamo aporta `valor * (1 + tipoInteres/100)`).
  - Test(s): `src/modules/cartera/prestamo.service.spec.ts`

## Decisiones tomadas durante la implementación
- `eliminarCuota`: la prohibición se evalúa antes de la transacción; se elimina el desligue manual del pago (que ya no aplica) y la reversión de caja de cuotas pagadas.
- `eliminarPago`: reabre la cuota a `pendiente` (el job de mora la marcará `atrasada` si su vencimiento pasó); así "revertir el pago" habilita el borrado de la cuota.
- `registrarAbono`: liquida con `input.valor >= deudaActual` (el `>` ya se rechaza arriba).
- Topes: `valorTotalNuevo = input.valor * (1 + tipoInteres/100)` en cupo y tope (consistente con `saldoVigente`, que suma `valorEsperado`).

## Ambigüedades resueltas con el usuario
- Abono que iguala la deuda → **liquidar automáticamente**.
- Tope de deuda → **cupo vs saldo con interés**.
- Pagos huérfanos → **prohibir borrar cuota pagada** (revertir el pago primero; `eliminarPago` reabre la cuota).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (107 suites, 974 tests) + `npm run test:e2e` (58 suites, 411 tests) → verde.
- Archivos modificados:
  - `src/modules/cartera/abonos.service.ts` (+ `.spec.ts`) — rechaza abono `liquidado`; liquida el préstamo al saldar la deuda.
  - `src/modules/cartera/cuota.service.ts` (+ `.spec.ts`) — prohíbe eliminar cuota `pagada` (sin desligue de pago ni reversión de caja).
  - `src/modules/cartera/pagos.service.ts` (+ `.spec.ts`) — `eliminarPago` reabre la cuota.
  - `src/modules/cartera/prestamo.service.ts` (+ `.spec.ts`) — cupo/tope con el total del nuevo préstamo con interés.
  - `test/e2e/gestion-cuotas-abonos.e2e-spec.ts` — e2e de borrado de cuota pagada actualizado a 400.
- Pendientes/seguimiento: el panel no expone borrado de pagos (solo la APK del cobrador, `DELETE /cobrador/.../pagos/:pagoId`), por lo que "revertir el pago" para habilitar el borrado de una cuota es, hoy, una operación del cobrador.
