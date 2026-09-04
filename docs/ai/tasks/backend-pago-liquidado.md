# backend-pago-liquidado

- **Rama:** `feature/backend-pago-liquidado` (desde `develop`)
- **Estado:** en progreso
- **Dependencias:** ninguna (base del bloque de liquidación)
- **Alcance (TDD):** marcar los pagos/abonos como liquidados al generar la liquidación del día y exponer el detalle.

## Objetivo

Cuando se genera la liquidación de la ruta (fin del día), los pagos y abonos
registrados en ese periodo quedan **marcados como liquidados**. Solo los pagos
**no liquidados** podrán borrarse desde la APK (siguiente tarea). Además, la
liquidación y el detalle de cuota deben exponer el detalle de pagos/abonos.

## Cambios

### Entidades (`synchronize` en dev aplica el esquema)
- `src/modules/cartera/pago.entity.ts`: columnas
  - `liquidado` (`boolean`, default `false`)
  - `fechaLiquidacion` (`timestamp`, nullable)
- `src/modules/cartera/abono.entity.ts`: idem.

### LiquidacionesService (`src/modules/rutas/liquidaciones.service.ts`)
- En `generar` (dentro de la transacción): marcar `liquidado=true` +
  `fechaLiquidacion=ahora` en los pagos y abonos del periodo vigente
  (misma ventana `calcularVentanaPeriodo` que los totales).
- `LiquidacionPublic`: agregar `pagos` y `abonos` (detalle del día):
  `{ id, clienteId, clienteNombre, valor, metodoPago, fechaHora, liquidado }`.

### DetalleCuotaService (`src/modules/cartera/detalle-cuota.service.ts`)
- `PagoDetalleCuotaPublic`: agregar `liquidado`.
- `DetalleCuotaPublic`: agregar `abonos: { id, valor, fechaHora }[]`
  (abonos del préstamo, ordenados), para poder listarlos/borrarlos desde la
  modal de cuota de la APK.

## Definición de Terminado
- `scripts/check.sh` backend verde (lint + typecheck + tests).
- Specs actualizados: `liquidaciones.service.spec.ts`, `detalle-cuota.service.spec.ts`, entidades.
- Commit convencional + PR a `develop` (CI verde) vía `git-release-manager`.

## Resultado real
- Entidades `pago`/`abono`: columnas `liquidado` (bool default false) + `fechaLiquidacion` (nullable).
- `LiquidacionesService.generar`: dentro de la transacción marca como liquidados los pagos/abonos del periodo (`manager.getRepository(Pago/Abono).find` + `save`); la respuesta incluye `pagos`/`abonos` con `{ id, clienteId, clienteNombre, valor, metodoPago, fechaHora, liquidado }`.
- `LiquidacionPublic` + `ItemLiquidacionDetallePublic`; `toPublic` devuelve `pagos/abonos: []` por defecto (listas del historial sin detalle).
- `DetalleCuotaPublic`: `pagos[].liquidado` + `abonos: { id, valor, fechaHora, liquidado }[]` (abonos del préstamo).
- Specs: `liquidaciones.service.spec.ts` (15) + `detalle-cuota.service.spec.ts` (6). `scripts/check.sh` verde (865 tests).