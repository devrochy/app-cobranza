---
estado: completada
tags: [tarea]
---

# Tarea: Robustez financiera — locks/transacciones en pagos, abonos, inyecciones y caja

- **Origen:** Petición directa del usuario (2026-09-11) — pendiente #4 del backlog (`docs/ai/tasks/backlog.md`: "Concurrencia en pagos/abonos y saldo de caja sin lock", "Wiring de inyección+caja sin transacción", "Concurrencia sin lock en inyecciones y caja").
- **Estado:** completada
- **Fecha inicio:** 2026-09-11

## Objetivo
Eliminar condiciones de carrera y lost-updates en el núcleo financiero: caja (saldo), inyecciones, pagos de cuota y abonos, con locks pesimistas y UPDATEs condicionales dentro de transacciones.

## Fuera de alcance
- TOCTOU en `decidirPropuesta` (HU-47) y transaccionalidad de trayectorias (HU-49) — ítems separados del backlog.
- Abono que iguala la deuda sin liquidar el préstamo (ítem aparte).

## Bloques (checklist TDD)
- [x] Bloque A: `CajaService.aplicarMovimiento` usa lock pesimista (`pessimistic_write`) sobre la fila de caja (evita lost update del saldo).
  - Test(s): `src/modules/rutas/caja.service.spec.ts`
- [x] Bloque B: `InyeccionesService.crear/eliminar` envueltos en transacción + UPDATE condicional idempotente en `eliminar` (`WHERE estado='activa'`) + `manager` a caja.
  - Test(s): `src/modules/rutas/inyecciones.service.spec.ts`
- [x] Bloque C: `PagosService.registrarPagoDeCuota` usa UPDATE condicional de la cuota (`WHERE estatus <> 'pagada'`) dentro de la transacción (evita doble pago).
  - Test(s): `src/modules/cartera/pagos.service.spec.ts`
- [x] Bloque D: `AbonosService.registrarAbono` calcula la deuda dentro de la transacción con lock pesimista sobre el préstamo (evita doble abono que exceda la deuda).
  - Test(s): `src/modules/cartera/abonos.service.spec.ts`
- [x] Bloque E (hallazgo de revisión): `eliminarPago`/`eliminarAbono`/`eliminarCuota` (y `InyeccionesService.eliminar`) protegen contra doble reversión de caja ante DELETE concurrente: chequean `affected === 0` antes de revertir caja.
  - Test(s): `src/modules/cartera/pagos.service.spec.ts`, `src/modules/cartera/abonos.service.spec.ts`, `src/modules/cartera/cuota.service.spec.ts`, `src/modules/rutas/inyecciones.service.spec.ts`

## Decisiones tomadas durante la implementación
- Lock pesimista (`pessimistic_write`) para acumuladores (saldo de caja, deuda de préstamo) — serializa operaciones concurrentes.
- UPDATE condicional para transiciones de estado idempotentes (cuota pagada, inyección eliminada), mismo patrón que `gastos.aprobar`.
- Todos los movimientos de caja pasan `manager` dentro de una transacción (tras Bloque B).
- Eliminación con checado de `affected`: si el `delete`/UPDATE condicional afecta 0 filas, otro request ya lo eliminó → se omite la reversión de caja (evita doble reversión).

## Ambigüedades resueltas con el usuario
- (ninguna; alcance Backend puro, sin cambios de contrato)

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (107 suites, 961 tests) + `npm run test:e2e` (57 suites, 407 tests) → verde.
- Archivos modificados:
  - `src/modules/rutas/caja.service.ts` (+ `.spec.ts`) — lock pesimista en `aplicarMovimiento`.
  - `src/modules/rutas/inyecciones.service.ts` (+ `.spec.ts`) — transacción + UPDATE condicional.
  - `src/modules/cartera/pagos.service.ts` (+ `.spec.ts`) — UPDATE condicional de cuota + `affected` en `eliminarPago`.
  - `src/modules/cartera/abonos.service.ts` (+ `.spec.ts`) — deuda en transacción + lock sobre préstamo + `affected` en `eliminarAbono` (+ se quitó la inyección sin uso de `cuotaRepo`).
  - `src/modules/cartera/cuota.service.ts` (+ `.spec.ts`) — reorden de `eliminarCuota`: desliga el pago, borra, checa `affected` antes de revertir caja.
  - `docs/ai/tasks/robustez-financiera.md` — este archivo.
- PR: https://github.com/devrochy/app-cobranza/pull/118
- Pendientes/seguimiento: TOCTOU en `decidirPropuesta` (HU-47), trayectorias no transaccionales (HU-49) y abono que iguala la deuda sin liquidar (ítems separados del backlog).
