# Tarea: Generación de liquidación de ruta (HU-20)

- **Origen:** Roadmap Fase 2 ítem 14 (docs/plan-feature-roadmap.md:35) — HU-20 (docs/APP_REQUIREMENTS.md:72). Tabla PRD 4.2:317 (liquidaciones); `periodo_liquidacion` PRD 4.2:276.
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Generar la liquidación de una ruta según su `periodo_liquidacion` configurado (diario/semanal/quincenal/mensual), de forma manual, persistiendo un snapshot inmutable en `liquidaciones` con caja, cobrado, prestado, gastos, inyecciones, cartera y comisión. Solo generación (historial/export en ítem 15).

## Fuera de alcance
- Historial consultable y exportación a Excel (HU-22/HU-50 → ítem 15).
- Generación automática por job (manual en esta iteración).
- Descuento de comisión de la caja (snapshot puro, no toca saldo_actual).
- Detalle/resumen completo de ruta (HU-51 → ítem 16).
- Notificaciones de liquidación (Fase 4).

## Decisiones tomadas durante la implementación
- Comisión = `total_cobrado_periodo × (comision_porcentaje/100)` solo si `comisionActiva` (base: total cobrado del periodo).
- `caja_anterior` = `saldoActual` de la última liquidación; si no hay previa, = `saldoInicial` de la caja.
- Una liquidación por periodo, generación manual; si ya existe la del periodo vigente → devolver la existente (409 o devolución).
- Solo snapshot: no modifica la caja.
- Cobrado (periodo/día) = solo PAGOS de cuotas (sin abonos).
- `suma_cartera` = deuda pendiente = cuotas pendientes/atrasadas vigentes − abonos acumulados.
- `estimado_a_cobrar` = suma de valor_esperado de cuotas pendientes/atrasadas de préstamos vigentes en la ventana del periodo.
- Agregar `periodo_liquidacion` a `ruta_config` (PRD 4.2:276, ausente en la entidad) con default `diario`.
- Lógica de ventana de periodo y comisión como funciones puras en `src/domain` (patrón `calcularColorRiesgo`).

## Bloques (checklist TDD)
- [x] Bloque 0: Función pura `calcularVentanaPeriodo` (diario/semanal/quincenal/mensual) + `calcularComision`. 8 tests.
- [x] Bloque 1: Agregar `periodo_liquidacion` a `ruta_config` (entidad + DTO matriz, default `diario`).
- [x] Bloque 2: Entidad `Liquidacion` (PRD 4.2:317) + registro en módulo.
- [x] Bloque 3: `LiquidacionesService.generar` con cálculos y snapshot transaccional. 5 tests unitarios.
- [x] Bloque 4: `POST /rutas/:id/liquidaciones` (gated `generar_reporte`) + e2e (6 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: base de comisión → **total cobrado del periodo**.
- Pregunta: caja_anterior → **última liquidación / saldo inicial**.
- Pregunta: modelo de generación → **una por periodo, manual**.
- Pregunta: efecto en caja → **solo snapshot, no toca caja**.
- Pregunta: alcance → **solo generación**.
- Pregunta: cobrado incluye abonos → **solo pagos de cuotas**.
- Pregunta: suma_cartera → **deuda pendiente (cuotas − abonos)**.
- Pregunta: estimado_a_cobrar → **cuotas pendientes del periodo**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `liquidacion.e2e-spec.ts`, 6 tests).
- Archivos modificados:
  - `src/domain/liquidacion.ts` (+spec) — `PERIODO_LIQUIDACION`, `calcularVentanaPeriodo`, `calcularComision`.
  - `src/modules/rutas/ruta-config.entity.ts` — campo `periodoLiquidacion` (default `diario`).
  - `src/modules/rutas/ruta-config.service.ts` — interfaz/defaults/toPublic con `periodoLiquidacion`.
  - `src/modules/rutas/dto/update-ruta-config-matrix.dto.ts` — `periodoLiquidacion` validado con `IsIn(PERIODO_LIQUIDACION)`.
  - `src/modules/rutas/liquidacion.entity.ts` (nuevo) — tabla `liquidaciones` (PRD 4.2:317).
  - `src/modules/rutas/liquidaciones.service.ts` (+spec) — `generar` con agregaciones y snapshot.
  - `src/modules/rutas/liquidaciones.module` / `rutas.module.ts` — registro de `Liquidacion` + `LiquidacionesService`.
  - `src/modules/rutas/dto/generar-liquidacion.dto.ts` (nuevo) — `comentario` opcional.
  - `src/modules/rutas/rutas.controller.ts` (+spec) — `POST /rutas/:id/liquidaciones` gated por `generar_reporte`.
  - `test/e2e/liquidacion.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/liquidacion-ruta.md` (este archivo).
- Limitación conocida: los pagos con `cuota_id` NULL (huérfanos tras HU-48) no se atribuyen a la ruta en `sumaPagos` (solo pagos de cuotas con préstamo). Registrado en backlog.
- Revisión independiente (code-reviewer, 2026-08-19): **NO APROBADO → corregido y re-verificado**. Bloqueantes atendidos: (a) `estimado_a_cobrar` ahora filtra `c.fecha_vencimiento` dentro de la ventana (test unitario nuevo); (b) `generar` ahora es transaccional (`dataSource.transaction` + manager) y `liquidaciones` tiene `Unique(ruta, periodo, fecha)` para cerrar la condición de carrera del 409. Observaciones atendidas: `sumaGastosAprobados` filtra `estado='activo'`; `sumaAbonos` y `sumaPagos` filtran `p.estatus='vigente'`. Nit de docs corregido (sin `liquidaciones.module`, registro directo en `rutas.module`).
- Pendientes/seguimiento:
  - Historial consultable + exportación Excel (HU-22/HU-50 → ítem 15).
  - Detalle/resumen de ruta (HU-51 → ítem 16).
  - La suma de cartera/estimado tras eliminar cuotas (HU-48) no cuadra con el valor original del préstamo (ya en backlog).
  - Login del cobrador para `generar_reporte` alcanzable.
  - Zona horaria: fijar TZ en docker-compose para que el corte diario de la ventana sea consistente con `pagos.fecha_hora`/`gastos.fecha_hora` (observación code-reviewer, MVP).