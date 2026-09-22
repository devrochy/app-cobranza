---
estado: en progreso
tags: [tarea]
---

# Tarea: Importar cartera desde cartera.xlsx (clientes + préstamos + estado)

- **Origen:** Petición directa del usuario (2026-09-19).
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-19

## Objetivo

Importar una hoja `cartera.xlsx` dentro de una cartera: crea clientes y préstamos y
deja el préstamo actualizado según el estado reportado (cuotas pagadas / liquidado).
Empieza por el backend; luego el panel.

## Columnas esperadas (la hoja debe incluir las nuevas)

FECHA, NOMBRE, **APELLIDO**, **CEDULA**, **TELEFONO**, **LATITUD**, **LONGITUD**,
PRESTAMO, INTERES, VALOR TARJETA, NRO CUOTAS, VALOR CUOTA, CUOTAS A LA FECHA,
LIQUIDO, COBRO, CUOTAS CARTERA, CARTERA, **DIAS ENTRE CUOTAS**.

## Reglas confirmadas

- `PRESTAMO` = capital; `tipoInteres = INTERES/PRESTAMO*100`.
- `CUOTAS A LA FECHA` = cuotas ya pagadas → se marcan `pagada` (pago por cuota, efectivo); el resto `pendiente`.
- `LIQUIDO == NRO CUOTAS` → préstamo `liquidado`; si no, `vigente`.
- Dedupe: cliente por `CEDULA` dentro de la cartera; préstamo por (cliente + fechaOtorgado).
- Fechas retroactivas permitidas (solo en importación).
- Se ignoran filas con `PRESTAMO` vacío/0 (sección de resumen del negocio).

## Fuera de alcance

- Importar la sección de caja/gastos (tarea separada).
- APK (fase siguiente).

## Bloques (checklist TDD)

- [x] Bloque 1: `parsearCarteraXlsx(buffer)` lee la hoja y devuelve filas tipadas (montos, fecha, interés derivado, columna por nombre).
  - Test(s): `src/modules/importar-cartera/importar-cartera.parser.spec.ts`
- [x] Bloque 2: `validarFilas(filas)` valida por fila (obligatorios, cédula, teléfono, montos, coherencia VALOR TARJETA/VALOR CUOTA/COBRO/CUOTAS CARTERA, duplicados).
  - Test(s): `src/modules/importar-cartera/importar-cartera.validacion.spec.ts`
- [x] Bloque 3: `ImportarCarteraService.importar(...)` crea clientes/préstamos/cuotas/pagos y liquida, con dedupe, en transacción.
  - Test(s): `src/modules/importar-cartera/importar-cartera.service.spec.ts`
- [x] Bloque 4: endpoint `POST /carteras/:carteraId/importar` (multipart + `?dryRun`).
  - Test(s): `src/modules/importar-cartera/importar-cartera.controller.spec.ts`

## Decisiones tomadas durante la implementación

- Módulo nuevo `importar-cartera` (no se toca el flujo manual de clientes/préstamos).
- El import crea entidades directamente (transacción), saltando la regla ±30 días y sin exigir fotos/documento (los datos importados no traen evidencias).
- `diasEntreCuotas` se toma de la columna nueva (no se infiere).

## Resultado final (llenar al completar)

- Comandos ejecutados para verificar: `bash scripts/check.sh` → lint OK, typecheck OK, **124 suites / 1052 tests**.
- Archivos modificados (backend): `src/modules/importar-cartera/{importar-cartera.module.ts, importar-cartera.parser.ts (+.spec), importar-cartera.validacion.ts (+.spec), importar-cartera.service.ts (+.spec), importar-cartera.controller.ts (+.spec)}`, `src/app.module.ts`.
- Pendientes/seguimiento: la UI de importación del **panel** (upload + vista previa + reporte) queda como siguiente fase.
