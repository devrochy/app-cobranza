# Tarea: Detalle/resumen de ruta con visibilidad por flags (HU-51)

- **Origen:** Roadmap Fase 2 ítem 16 (docs/plan-feature-roadmap.md:37) — HU-51 (docs/APP_REQUIREMENTS.md:76). Catálogo `ver_cartera` PRD:264 (cobrador).
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Endpoint `GET /rutas/:id/resumen` (gated por `ver_reportes`) que consolida el estado de la ruta (caja, última liquidación, gastos, cobrado/prestado del periodo, inyecciones, cartera vigente, préstamos activos, comisión y clientes), con visibilidad de campos sensibles controlada por los flags de `ruta_config`.

## Fuera de alcance
- Login del cobrador y aplicación real de `ver_cartera`/flags restringida a rol cobrador.
- Dashboard ejecutivo multi-ruta (HU-23).
- Reporte diario detallado con clientes visitados/sin pago y trayectorias (HU-18/HU-49, Fase 3).
- Exportación del resumen a Excel.
- Lista de clientes del día con colores/navegación (HU-56/57/58/59, Fase 3).

## Decisiones tomadas durante la implementación
- Permiso del endpoint: `ver_reportes` (socio/admin); `ver_cartera` queda en catálogo del cobrador (inalcanzable MVP).
- Flags de `ruta_config` ocultan campos sensibles (misma lógica admin/socio en MVP).
- Contenido: resumen completo + lista de clientes con datos básicos.
- Ventana temporal: misma que la liquidación (`periodo_liquidacion` + `calcularVentanaPeriodo`).

## Bloques (checklist TDD)
- [x] Bloque 0: Función pura `aplicarVisibilidad` (flags → campos ocultos) en `src/domain/resumen-ruta.ts`. 6 tests.
- [x] Bloque 1: `RutasResumenService.obtener` — caja, última liquidación, totales (reutiliza `LiquidacionesService.calcularTotales`), préstamos activos, clientes. 4 tests unitarios.
- [x] Bloque 2: Aplicar flags de visibilidad al resumen. Cubierto en Bloque 1 (test de `mostrarCaja=false`).
- [x] Bloque 3: Endpoint `GET /rutas/:id/resumen` (ver_reportes) + e2e (4 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.
- Refactor asociado: `LiquidacionesService` expone `calcularTotales(rutaId, inicio, fin, manager?)` (manager opcional) reutilizado por `generar` y `RutasResumenService` (anti-redundancia §5).

## Ambigüedades resueltas con el usuario
- Pregunta: permiso → **ver_reportes**.
- Pregunta: flags → **ocultar campos por flags**.
- Pregunta: contenido → **resumen completo + clientes**.
- Pregunta: ventana → **misma que liquidación**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `detalle-ruta.e2e-spec.ts`, 4 tests).
- Archivos modificados:
  - `src/domain/resumen-ruta.ts` (+spec) — `ResumenRuta`, `FlagsVisibilidad`, `aplicarVisibilidad`.
  - `src/modules/rutas/rutas-resumen.service.ts` (+spec) — `obtener` (nuevo).
  - `src/modules/rutas/liquidaciones.service.ts` — refactor: `calcularTotales` público + `qb(manager?)`; `generar` lo usa.
  - `src/modules/rutas/rutas.controller.ts` (+spec) — `GET /rutas/:id/resumen` gated por `ver_reportes`.
  - `src/modules/rutas/rutas.module.ts` — registro de `RutasResumenService`.
  - `test/e2e/detalle-ruta.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/detalle-ruta.md` (este archivo).
- Pendientes/seguimiento:
  - `ver_cartera` (catálogo del cobrador, PRD:264) inalcanzable hasta login de cobrador; el resumen usa `ver_reportes`. Registrado en backlog.
  - `clientes.color_riesgo` existe en la entidad pero no se expone en el resumen (wiring de color de riesgo queda pendiente; ver backlog HU-13).
  - Lista de clientes con datos más completos (foto, teléfono, saldo, mora) → HU-58 (Fase 3).
  - Dashboard ejecutivo (HU-23).
  - El e2e/unit no ejercita las queries SQL reales de `contarPrestamosActivos`/`listarClientes` con datos (se mockean en unit y el e2e usa tablas vacías); cerrar hueco en Fase 3 al crear clientes/préstamos en e2e.
- Revisión independiente (code-reviewer, 2026-08-19): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) comisión reutiliza `calcularComision` (redondeo + protección %, anti-redundancia); (b) flag `mostrarFechaUltimaLiquidada` ahora gatea `fechaUltimaLiquidacion` (se expone en el resumen, con tests); (c) quitado `telefono_whatsapp` del SELECT (dato no expuesto); (d) doc corregida (`color_riesgo` sí existe en la entidad). Nits documentados sin cambio: `RequesterResumenContext` duplica forma de `RequesterLiquidacionContext`; `socio-det-2` se limpia en el test (podría moverse a afterAll); uso de `liquidacionRepo.manager` vs `DataSource`.