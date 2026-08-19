# Tarea: Tarjeta de cliente con detalle (HU-58)

- **Origen:** Roadmap Fase 3 ítem 20 (docs/plan-feature-roadmap.md:44) — HU-58 (docs/APP_REQUIREMENTS.md:108).
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Endpoint `GET /rutas/:rutaId/clientes/:clienteId/tarjeta` (gated `ver_reportes`) que devuelve los datos de la tarjeta del cliente (foto, nombre, tipo de pago, negocio, color, teléfono, saldo pendiente, días de mora) con detalle fino expandible.

## Fuera de alcance
- Descarga del binario de la foto (endpoint de evidencia) — queda en backlog.
- Campo `tipo_pago` explícito en esquema (se deriva de `diasEntreCuotas`; sin migración).
- Renderizado de la tarjeta en front/panel (el backend solo provee datos).
- Navegación al cliente → HU-59 (ítem 21).
- Wiring persistido del color de riesgo (HU-13) (backlog).

## Decisiones tomadas durante la implementación
- Tipo de pago derivado de `prestamos.diasEntreCuotas` (1=diario, 7=semanal, 15=quincenal, 30=mensual); "Varios" si difieren entre préstamos vigentes; "fecha específica" no inferible → documentado.
- Foto: devolver `ruta_archivo` de `foto_facial` (el front la sirve; la descarga del binario queda en backlog).
- Días de mora = días desde la cuota pendiente/atrasada más antigua (0 si no hay vencidas).
- Saldo pendiente = cuotas pendientes/atrasadas de préstamos vigentes − abonos.
- Endpoint de tarjeta por cliente (no amplía la lista del día).

## Bloques (checklist TDD)
- [x] Bloque 0: Funciones puras `tipoPagoDesdeDiasEntreCuotas` y `diasDeMora` (acepta string/Date) en `src/domain/tarjeta-cliente.ts`. 9 tests.
- [x] Bloque 1: `ClienteTarjetaService.obtener` — foto (ruta_archivo), tipo de pago (derivado), saldo (cuotas − abonos), días de mora, color, teléfono, negocio. 5 tests unitarios.
- [x] Bloque 2: Endpoint `GET /rutas/:rutaId/clientes/:clienteId/tarjeta` (ver_reportes) + e2e (4 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: tipo de pago → **derivar de diasEntreCuotas**.
- Pregunta: foto → **devolver ruta_archivo**.
- Pregunta: días de mora → **días desde la cuota vencida más antigua**.
- Pregunta: integración → **endpoint de tarjeta por cliente**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `tarjeta-cliente.e2e-spec.ts`, 4 tests).
- Archivos modificados:
  - `src/domain/tarjeta-cliente.ts` (+spec) — `tipoPagoDesdeDiasEntreCuotas`, `diasDeMora`.
  - `src/modules/cartera/cliente-tarjeta.service.ts` (+spec) — `obtener`, `obtenerPrestamosVigentes`, `obtenerSaldoYMorosidad`.
  - `src/modules/cartera/cartera.controller.ts` (+spec) — `GET /rutas/:rutaId/clientes/:clienteId/tarjeta` gated por `ver_reportes`.
  - `src/modules/cartera/cartera.module.ts` — registro de `ClienteTarjetaService`.
  - `test/e2e/tarjeta-cliente.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/tarjeta-cliente.md` (este archivo).
- Decisiones de implementación:
  - Tipo de pago derivado de `prestamos.dias_entre_cuotas` (1=diario, 7=semanal, 15=quincenal, 30=mensual; "Varios" si difieren; null si sin préstamos).
  - `diasDeMora` acepta `string | Date` (getRawOne de Postgres devuelve Date); maneja fechas futuras/NaN como 0.
  - Foto = `ruta_archivo` de `foto_facial` (descarga del binario queda en backlog).
- Revisión independiente (code-reviewer, 2026-08-19): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendida: (a) tests de `diasDeMora` con Date, fecha futura y NaN (3 tests nuevos). Nits documentados sin cambio: (b) la query SQL de saldo/morosidad solo se valida vía e2e (no unit); (c) el e2e no crea foto_facial (fotoUrl solo en unit); (d) la suma de abonos resta todos los abonos de préstamos vigentes (consistente con "cuotas − abonos" de la decisión).
- Pendientes/seguimiento:
  - Descarga del binario de la foto (endpoint de evidencia) — backlog.
  - "Fecha específica" como tipo de pago no inferible de `diasEntreCuotas` — documentado.
  - Wiring persistido del color de riesgo (HU-13) en `clientes.colorRiesgo` (backlog).
  - Navegación al cliente → HU-59 (ítem 21).