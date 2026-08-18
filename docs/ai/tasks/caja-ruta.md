# Tarea: Caja de ruta (saldo inicial, saldo vivo, historial de ajustes, wiring inyecciones)

- **Origen:** Roadmap Fase 1 ítem 6 (docs/plan-feature-roadmap.md:24) — amplía HU-08 (docs/APP_REQUIREMENTS.md:45) y HU-11 (:48). Tablas PRD 4.2:278-282, nota PRD 4.3:366.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Crear la caja de ruta como entidad viva 1:1 con saldo inicial obligatorio al registrar la ruta, saldo actual persistido y actualizado por el wiring con inyecciones (crear/eliminar), registrando cada movimiento en `caja_ajustes_log` con auditoría. Exponer endpoint GET de caja.

## Fuera de alcance
- Wiring con pagos/abonos (HU-15, ítem 7), préstamos (disminución de caja) y gastos (HU-17, ítem 9).
- Ajuste manual de caja con endpoint (solo movimientos automáticos, decisión del usuario).
- Liquidación (HU-20, ítem 14) y detalle/resumen de ruta completo (HU-51, ítem 16).

## Decisiones tomadas durante la implementación
- Saldo inicial: **obligatorio en POST /rutas** (decisión del usuario) → rompe contrato actual; se actualizan e2e/tests de creación de ruta.
- Historial de ajustes: **solo movimientos automáticos** del wiring con inyecciones (sin endpoint manual).
- Persistencia: **saldo_actual persistido y actualizado** en cada operación.
- Lectura: **sí, endpoint GET de caja** gated por ownership.
- Creación de ruta+caja: debe ser consistente (si falla la caja, no quedar ruta sin caja).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidades `Caja` y `CajaAjusteLog` + `CajaService` (`crearCaja`, `aplicarMovimiento`, `consultar`).
  - Test(s): `src/modules/rutas/caja.service.spec.ts`
- [x] Bloque 2: Saldo inicial obligatorio en `POST /rutas` (`CreateRutaDto`, `CreateRutaInput`, `RutasService.create` creando caja) + actualizar e2e/tests de creación de ruta.
  - Test(s): `src/modules/rutas/rutas.service.spec.ts`, `test/e2e/rutas.e2e-spec.ts` y otros que crean rutas
- [x] Bloque 3: Wiring con inyecciones — `InyeccionesService.crear` (+valor), `eliminar` (−valor si estaba `activa`) → `aplicarMovimiento` + log.
  - Test(s): `src/modules/rutas/inyecciones.service.spec.ts`, e2e `inyecciones`
- [x] Bloque 4: Endpoint GET de caja (ownership) en `rutas.controller.ts`.
  - Test(s): `src/modules/rutas/rutas.controller.spec.ts`, e2e
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿cómo introducir el saldo inicial obligatorio? → **Obligatorio en POST /rutas**.
- Pregunta: ¿qué registra en caja_ajustes_log? → **Solo movimientos automáticos** (wiring inyecciones).
- Pregunta: ¿saldo persistido o derivado? → **saldo_actual persistido y actualizado**.
- Pregunta: ¿exponer endpoint de lectura? → **Sí, GET de caja**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 243 tests) y `npm run test:e2e` (17 suites, 148 tests) en verde.
- Archivos modificados: `src/modules/rutas/caja.entity.ts`, `caja-ajuste-log.entity.ts`, `caja.service.ts` (+spec), `rutas.service.ts` (+spec), `rutas.controller.ts` (+spec), `inyecciones.service.ts` (+spec), `rutas.module.ts`, `dto/create-ruta.dto.ts`, `test/e2e/rutas.e2e-spec.ts`, `registrar-inyeccion.e2e-spec.ts`, `eliminar-inyeccion.e2e-spec.ts`, `docs/ai/tasks/backlog.md`, `docs/ai/tasks/caja-ruta.md`.
- **Revisión final (code-reviewer, 2026-08-17):** REQUIERE CAMBIOS → atendidos. (1) Creación ruta+caja ahora es **transaccional** (`dataSource.transaction` con `CajaService.crearCaja(..., manager)`); (2) GET de caja ahora tiene `@PermisoRequerido("ver_reportes")` (decisión del usuario) y e2e nuevo de socio con/sin permiso; (3) wiring de inyección+caja sin transacción → registrado en backlog (regla anti-redundancia §5, no se mezcla en esta iteración).
- Pendientes/seguimiento: transaccionalidad del wiring inyección+caja (backlog); wiring con pagos/abonos (HU-15, ítem 7), préstamos y gastos (HU-17, ítem 9); liquidación (HU-20, ítem 14); detalle de ruta (HU-51, ítem 16). **Pendiente commit + PR.**
