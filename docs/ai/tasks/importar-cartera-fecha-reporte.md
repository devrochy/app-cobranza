---
estado: completada
tags: [tarea]
---

# Tarea: Fecha de reporte global y pagos retro-fechados (importar cartera)

- **Origen:** Petición directa del usuario (2026-09-23), sobre `importar-cartera-xlsx.md` y `importar-cartera-fechas-cuotas.md`.
- **Estado:** completada (pendiente commit + PR)
- **Fecha inicio:** 2026-09-23

## Objetivo

Permitir declarar en `cartera.xlsx` una **fecha de reporte global** (una celda etiquetada `FECHA REPORTE`, por
defecto hoy) y usarla para **fechar los pagos hacia atrás**: el pago de la cuota #`CUOTAS A LA FECHA` cae en la fecha
de reporte y los anteriores retroceden por `DIAS ENTRE CUOTAS`.

## Reglas confirmadas con el usuario

- El documento objetivo es `cartera.xlsx` (el que importa el backend).
- La `FECHA` por fila sigue siendo la fecha reportada de esa fila (se mantiene el anclaje de cuotas ya implementado).
- Solo se retro-fecan **los pagos** (`pago.fecha_hora`), no los vencimientos de cuotas.
- La fecha de reporte es un **valor único global** en una celda con etiqueta `FECHA REPORTE`; si falta → **hoy (UTC)**.
- Aplica también a los datos ya importados (backfill one-off de pagos).

## Fuera de alcance

- Cambiar el anclaje de `cuota.fecha_vencimiento` / `fechaOtorgado` (queda como en `importar-cartera-fechas-cuotas.md`).
- UI del panel (el `dryRun` devuelve `fechaReporte`, pero el panel no cambia).

## Bloques (TDD)

- [x] Bloque 1: parser lee la celda `FECHA REPORTE`; `parsearCarteraXlsx` devuelve `{ filas, fechaReporte }`
      (default hoy). Test(s): `importar-cartera.parser.spec.ts`.
- [x] Bloque 2: servicio fecha los pagos `fechaReporte − (cA − k) × dias`. Test(s): `importar-cartera.service.spec.ts`.
- [x] Bloque 3: controller pasa `fechaReporte` y la incluye en `dryRun`. Test(s): `importar-cartera.controller.spec.ts`.
- [x] Bloque 4: `docs/ddl/fix-fechas-pagos-importacion.sql` (idempotente) y aplicar a la cartera 1787.

## Decisiones

- La celda se busca por texto normalizado (`FECHA REPORTE`) en toda la hoja; se lee la celda inmediatamente a la derecha.
- El backfill calcula el valor **absoluto** (`fecha_reporte − (cA − k) × dias`), por lo que es idempotente.
- Los commits se suman a la rama `feature/importar-cartera-fechas-cuotas` (actualiza el PR #142).

## Resultado final (llenar al completar)

- Comandos ejecutados para verificar: `bash scripts/check.sh` → lint OK, typecheck OK, **124 suites / 1059 tests**.
- Archivos modificados:
  - `src/modules/importar-cartera/importar-cartera.parser.ts` — `COLUMNAS.FECHA_REPORTE`, `leerFechaReporte`,
    `parsearCarteraXlsx` devuelve `{ filas, fechaReporte }`.
  - `src/modules/importar-cartera/importar-cartera.service.ts` — `importar(..., fechaReporte, ...)`; `pago.fechaHora`
    retro-fechado.
  - `src/modules/importar-cartera/importar-cartera.controller.ts` — pasa `fechaReporte`; `dryRun` la devuelve.
  - Specs: `importar-cartera.{parser,service,controller}.spec.ts`.
  - `docs/ddl/fix-fechas-pagos-importacion.sql` — backfill idempotente.
  - `docs/ai/tasks/importar-cartera-fecha-reporte.md` — esta tarea.
- Backfill aplicado en local a la cartera **1787**: `UPDATE 6` pagos; verificado (997 cuota 1 → 2026-09-23;
  996 cuotas 1/2/3 → 09-21/09-22/09-23).
- Pendientes/seguimiento: commit + PR (suma a la rama `feature/importar-cartera-fechas-cuotas`, PR #142).
