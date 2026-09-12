---
estado: en progreso
tags: [tarea]
---

# Tarea: Recálculo del color de riesgo + limpieza de datos

- **Origen:** Petición directa del usuario (2026-09-12) al corregir la cuota de Juanita: el `colorRiesgo` solo se calculaba al crear un préstamo (`prestamo.service.ts:219`), por lo que quedaba desactualizado tras pagos/eliminaciones/mora.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-12

## Objetivo
Recalcular `colorRiesgo` en los flujos que cambian el atraso (registrar/eliminar pago, eliminar cuota, job de mora) y limpiar los colores ya inconsistentes.

## Fuera de alcance
- Cambiar la fórmula del color (`calcularColorRiesgo`).
- Abonos (no cambian el estatus de las cuotas).

## Bloques (checklist TDD)
- [x] Bloque 1: `ColorRiesgoService.recalcular(clienteId, rutaId)` (atraso + umbral → `calcularColorRiesgo`).
  - Test(s): `src/modules/cartera/color-riesgo.service.spec.ts`
- [x] Bloque 2: wiring en `PagosService.registrarPagoDeCuota` y `eliminarPago`.
  - Test(s): `src/modules/cartera/pagos.service.spec.ts`
- [x] Bloque 3: wiring en `CuotaService.eliminarCuota`.
  - Test(s): `src/modules/cartera/cuota.service.spec.ts`
- [x] Bloque 4: wiring en `MoraJobService.ejecutar`.
  - Test(s): `src/modules/cartera/mora-job.service.spec.ts`
- [x] Bloque 5: refactor de `PrestamoService.crear` para usar el servicio.
  - Test(s): `src/modules/cartera/prestamo.service.spec.ts`
- [x] Bloque 6: limpieza de datos (recalcular todos los clientes): `docs/ddl/fix-color-riesgo.sql`.

## Decisiones tomadas durante la implementación
- `ColorRiesgoService.recalcular` acepta un `EntityManager` opcional para participar de la transacción del flujo (lee el estado ya actualizado). `recalcularSeguro` no propaga errores (dato derivado).
- Se recalcula dentro de la transacción (pagos/cuota/mora) y no como paso posterior, para consistencia.
- El cleanup se aplicó con `docs/ddl/fix-color-riesgo.sql`: **21 clientes** pasaron de `azul` a `rojo`; quedaron 0 diferencias.

## Ambigüedades resueltas con el usuario
- Corregir el recálculo en los flujos **y** limpiar los colores ya stale.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (110 suites, 987 tests) + `npm run test:e2e` (58 suites, 411 tests) → verde.
- Archivos modificados:
  - `src/modules/cartera/color-riesgo.service.ts` (+ `.spec.ts`) — nuevo.
  - `src/modules/cartera/pagos.service.ts` (+ `.spec.ts`) — recalcula al registrar/eliminar pago.
  - `src/modules/cartera/cuota.service.ts` (+ `.spec.ts`) — recalcula al eliminar cuota.
  - `src/modules/cartera/mora-job.service.ts` (+ `.spec.ts`) — recalcula los clientes afectados por el job.
  - `src/modules/cartera/prestamo.service.ts` (+ `.spec.ts`) — usa `ColorRiesgoService` (sin duplicar la lógica).
  - `src/modules/cartera/cartera.module.ts` — registra el servicio.
  - `docs/ddl/fix-color-riesgo.sql` — cleanup de datos.
- Corrección puntual previa: cuota 3667 (Juanita) `pagada`→`atrasada` + auditoría; color corregido.
- Pendientes/seguimiento: el e2e `reglas-negociacion-ia` es flaky preexistente (pasa aislado; falla por estado compartido entre suites en paralelo), ajeno a este cambio. Registrado en `backlog.md`.
