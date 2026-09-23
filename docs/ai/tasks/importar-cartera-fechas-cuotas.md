---
estado: completada
tags: [tarea]
---

# Tarea: Fechas de cuotas importadas (retroceso desde la FECHA reportada)

- **Origen:** Petición directa del usuario (2026-09-22) sobre `importar-cartera-xlsx.md`.
- **Estado:** completada (pendiente commit + PR)
- **Fecha inicio:** 2026-09-22

## Objetivo

Al importar `cartera.xlsx`, las **cuotas pagadas** deben quedar fechadas **hacia atrás desde la `FECHA` reportada**
(la cuota #`CUOTAS A LA FECHA` cae en `FECHA`), y no hacia adelante como hoy. Además, corregir (backfill one-off)
los datos ya importados de la cartera inactiva donde se cargó la plantilla.

## Reglas confirmadas con el usuario

- "Fecha reportada" = columna `FECHA` de cada fila del xlsx.
- `fechaOtorgado = FECHA − (CUOTAS A LA FECHA × DIAS ENTRE CUOTAS)` días (UTC).
- Se generan las cuotas hacia adelante desde ese `fechaOtorgado` (generador sin cambios) ⇒ cuota #`CUOTAS A LA FECHA` = `FECHA`.
- Los `pago.fecha_hora` NO se retro-fecan (siguen siendo la fecha de importación).
- Backfill: SQL one-off en `docs/ddl/` (no idempotente), aplicado a la cartera ya importada.

## Fuera de alcance

- Recalcular mora/color de riesgo u otras fechas.
- UI del panel (no cambia: delega al backend).

## Bloques (TDD)

- [x] Bloque 1: tests del servicio (Red → Green): `fechaOtorgado` retrocedido, cuota #`cA` en `FECHA`,
      caso `cA = 0` sin cambio, dedupe por el `fechaOtorgado` calculado.
  - Test(s): `src/modules/importar-cartera/importar-cartera.service.spec.ts`
- [x] Bloque 2: implementar el retroceso en `ImportarCarteraService.importar`.
- [x] Bloque 3: `docs/ddl/fix-fechas-importacion-cartera.sql` (backfill, se corre una sola vez).

## Decisiones

- El dedupe de préstamo pasa a usar el `fechaOtorgado` calculado (coherente para re-importaciones post-fix).
- El backfill desplaza `prestamos.fecha_otorgado` y todas las `cuotas.fecha_vencimiento` `cA × dias` días atrás,
  con `cA` = nº de cuotas `pagada` y `dias` = `dias_entre_cuotas`.
- El backfill NO es idempotente: la BD no guarda la `FECHA` reportada por separado, así que el estado corregido
  es indistinguible del original. Documentado para correr una sola vez por entorno.

## Resultado final (llenar al completar)

- Comandos ejecutados para verificar: `bash scripts/check.sh` → lint OK, typecheck OK, **124 suites / 1056 tests**.
- Archivos modificados:
  - `src/modules/importar-cartera/importar-cartera.service.ts` — helper `restarDias`; `fechaOtorgado = FECHA − cA*dias`
    (aplica a otorgamiento, dedupe y generación de cuotas).
  - `src/modules/importar-cartera/importar-cartera.service.spec.ts` — 3 tests nuevos.
  - `docs/ddl/fix-fechas-importacion-cartera.sql` — backfill one-off.
  - `docs/ai/tasks/importar-cartera-fechas-cuotas.md` — esta tarea.
- Backfill aplicado en local a la cartera **1787 "Manizales" (bloqueada)**: `UPDATE 60` cuotas + `UPDATE 3`
  préstamos. Verificado: préstamo 997 pasó de cuota 1 = 2026-09-15 → **2026-09-08** (la FECHA reportada) y
  `fecha_otorgado` 2026-09-07 → 2026-08-31.
- Pendientes/seguimiento: commit + PR a `develop` (rama `feature/importar-cartera-fechas-cuotas`).
- Seguimiento (mismo PR): fecha de reporte global y pagos retro-fechados → `importar-cartera-fecha-reporte.md`.
