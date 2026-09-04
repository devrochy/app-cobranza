# backend-eliminar-pago

- **Rama:** `feature/backend-eliminar-pago` (desde `develop`)
- **Estado:** en progreso
- **Dependencias:** `backend-pago-liquidado` (campo `liquidado`)
- **Alcance (TDD):** endpoint para borrar un pago desde la APK; solo se permite
  si el pago NO está liquidado.

## Objetivo

La APK puede borrar un pago de cuota únicamente cuando ese pago **no ha sido
liquidado** en el cierre del día. El borrado requiere reautenticación
(password) y motivo, revierte el movimiento de caja y deja auditoría (mismo
patrón que `eliminarAbono`).

## Cambios

- `src/modules/cartera/pagos.service.ts`:
  - Constructor: + `ReautenticacionService` y repo `AuditoriaCartera`.
  - `eliminarPago(rutaId, pagoId, { password, motivo }, requester)`: valida
    ruta/ownership, reautenticación, motivo obligatorio; `NotFound` si el pago
    no es de la ruta; **`BadRequest` si `pago.liquidado`**; transacción: delete
    pago + reversión caja (`-valor`, `TipoMovimientoCaja.PAGO`) + auditoría
    (`entidad: "pago"`, operación `eliminar`).
- `src/modules/cobrador/cobrador.service.ts`: inyecta `PagosService` y delega
  `eliminarPago`.
- `src/modules/cobrador/cobrador.controller.ts`: `DELETE rutas/:rutaId/pagos/:pagoId`
  con `@CobradorPermisoRequerido("eliminar_pago")` y `OperacionAuditadaDto`.

## Definición de Terminado
- `scripts/check.sh` backend verde.
- Specs: `pagos.service.spec.ts` (eliminarPago), `cobrador.service.spec.ts` (delegación).
- Commit convencional + PR a `develop` (CI verde).

## Resultado real (llenar al completar)
- (pendiente)