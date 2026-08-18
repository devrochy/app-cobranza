# Tarea: Registrar visita de cliente con resultado, catálogo de motivos y promesa de pago (HU-46/HU-16)

- **Origen:** Roadmap Fase 1 ítem 8 (docs/plan-feature-roadmap.md:26) — HU-46 (docs/APP_REQUIREMENTS.md:63) y HU-16 (:59). Tablas PRD 4.2:310-311 (visitas) y :337-338 (promesas_pago).
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Registrar la visita de un cliente (HU-46) que, según su resultado, ejecuta el pago/abono (unificando con HU-15/ítem 7) o registra el motivo de no pago (HU-16); si el motivo es "compromiso de pago", genera una promesa de pago formal. Todo en una sola transacción.

## Fuera de alcance
- Notificaciones de visita/promesa por WhatsApp (Fase 4, HU-52/53).
- Promesas por IA en lenguaje natural (HU-28) y entidades auditables de IA (HU-34) — Fase 4.
- Reporte diario (HU-18/50) y lista de clientes del día (HU-56) — Fase 2/3.
- Días de mora para reportes/listas (Fase 2/3).
- Validación de los demás préstamos activos del cliente (queda como consulta futura).

## Decisiones tomadas durante la implementación
- La visita **ejecuta el pago/abono** reutilizando `PagosService`/`AbonosService` (decisión del usuario): se componen con `manager` opcional y `visitaId` (patrón de `CajaService.aplicarMovimiento`), todo en una transacción.
- Promesa: **fecha obligatoria + valor opcional** (default = valor de la cuota pendiente del préstamo principal).
- Préstamo principal: **explícito** (`prestamoId` en el body, validado contra la ruta).
- Gating: **`configurar_ruta` + ownership** (sin login de cobrador).
- Transacción: **todo en una sola transacción**.
- Catálogo de motivos fijo (HU-16): no está, no tiene dinero, se voló, pagó ya, no hay nadie, se trasladó, está enfermo, compromiso de pago, otro.

## Bloques (checklist TDD)
- [x] Bloque 0: Refactor de `PagosService`/`AbonosService` para aceptar `manager` opcional y `visitaId` (sin cambiar su comportamiento cuando no se componen).
  - Test(s): `pagos.service.spec.ts`, `abonos.service.spec.ts`
- [x] Bloque 1: Entidad `Visita` + entidad `PromesaPago` + catálogo `MOTIVOS_NO_PAGO` (src/domain) + registro en módulo.
  - Test(s): `motivos-no-pago.spec.ts`
- [x] Bloque 2: `VisitasService.registrar` — validaciones (ruta/cliente/préstamo explícito/ownership), resultado pago→ejecuta pago/abono, resultado no_pago→motivo y promesa si "compromiso de pago", todo transaccional.
  - Test(s): `visitas.service.spec.ts`
- [x] Bloque 3: Endpoint `POST /rutas/:rutaId/visitas` gated por `configurar_ruta` + ownership.
  - Test(s): `cartera.controller.spec.ts`, `test/e2e/visitas.e2e-spec.ts`
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿visita↔pago? → **La visita ejecuta el pago/abono**.
- Pregunta: ¿datos de la promesa? → **fecha obligatoria + valor opcional**.
- Pregunta: ¿préstamo principal? → **explícito**.
- Pregunta: ¿gating? → **configurar_ruta + ownership**.
- Pregunta: ¿transacción? → **todo en una sola transacción**.
- Pregunta: ¿base de rama? → PR #25 ya mergeada (la hizo el usuario); rama creada desde develop actualizado.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + tests) y `npm run test:e2e` (19 suites) en verde.
- Archivos modificados: `src/domain/motivos-no-pago.ts` (+spec), `src/modules/cartera/visita.entity.ts`, `promesa-pago.entity.ts`, `visitas.service.ts` (+spec), `pagos.service.ts`, `abonos.service.ts` (manager+visitaId opcionales), `cartera.controller.ts` (+spec), `cartera.module.ts`, `dto/registrar-visita.dto.ts`, `test/e2e/visitas.e2e-spec.ts`, `docs/ai/tasks/backlog.md`, `docs/ai/tasks/registrar-visita.md`.
- **Revisión final (code-reviewer, 2026-08-17):** REQUIERE CAMBIOS → atendidos. (B1) se agregó test unitario y e2e real del flujo `tipoPago: "abono"` vía visita (con saldo de caja); (B2) test de `pago de cuota sin cuotaId → 400`; (B3) test del default de `valorPrometido` (= cuota pendiente, 300) en `VisitasService`; (B4) se valida que la cuota pertenezca al préstamo principal declarado (404 si no). Observaciones: `valorPrometido` pasó de `@Min(0)` a `@IsPositive`; `conversacion_id`/`tipoPago` default/`fechaPrometida` futura/`esMotivoNoPagoValido` registrados en backlog.
- Pendientes/seguimiento: notificaciones de visita/promesa (Fase 4); promesas por IA (HU-28/34); reporte diario (HU-18/50); lista del día (HU-56); wiring de color de riesgo (HU-13) tras pago/abono; transición a `liquidado` del préstamo (backlog). **Pendiente commit + PR.**
