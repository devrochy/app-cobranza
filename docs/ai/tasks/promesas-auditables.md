# Tarea: Promesas de pago y acuerdos como entidades auditables vinculadas al préstamo (HU-34)

- **Origen:** Roadmap Fase 4 ítem 33 (docs/plan-feature-roadmap.md:62) — HU-34 (docs/APP_REQUIREMENTS.md:94). Tabla `promesas_pago` PRD 4.2:337-338; auditoría via `auditoria_cartera` (patrón HU-48).
- **Estado:** completada
- **Fecha inicio:** 2026-08-21

## Objetivo
Exponer las promesas/acuerdos (ya persistidos por IA en HU-28/29 y por cobrador en HU-46) como entidad auditable consultable y con ciclo de vida de estado: endpoint de consulta del historial de un préstamo y transición de estado (cumplida/incumplida) con registro imborrable en `auditoria_cartera`.

## Fuera de alcance
- Impacto de las promesas en reportes diarios y liquidaciones (diferido a HU-18/50/HU-20).
- Ejecución de reprogramación real de cuotas.
- Automatización de la transición de estado (marcar cumplida al registrarse el pago).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad — agregar `"promesa"` al union `AUDITORIA_CARTERA_ENTIDAD` (permite auditar transiciones).
- [x] Bloque 2: `PromesasPagoService` — `listarPorPrestamo` (todas, con origen) y `transicionarEstado` (con auditoría). Tests unitarios (8).
- [x] Bloque 3: Endpoints `GET /rutas/:rutaId/prestamos/:prestamoId/promesas` (ver_reportes) y `PATCH /rutas/:rutaId/promesas/:promesaId/estado` (generar_reporte) + DTO. Tests controller (2) + e2e (5).
- Verificación: `scripts/check.sh` + `npm run test:e2e` (con `--forceExit` por los crons).

## Decisiones tomadas durante la implementación
- Endpoint de consulta del historial muestra todas las promesas/acuerdos del préstamo (IA + cobrador + agente), con origen (conversación o visita).
- Transición de estado auditable en `auditoria_cartera` (entidad `promesa`, operacion `editar`, valoresAntes/Despues, actor, motivo), reutilizando el patrón HU-48.
- Permisos: GET `ver_reportes`, write `generar_reporte` (patrón del proyecto).
- Impacto en reportes/liquidaciones diferido a la iteración de reportes.

## Ambigüedades resueltas con el usuario
- Pregunta: entregable principal → **endpoint de consulta del historial**.
- Pregunta: alcance de la consulta → **todas, con origen (IA + cobrador + agente)**.
- Pregunta: impacto en reportes → **diferir a iteración de reportes**.
- Pregunta: ciclo de vida estado → **incluir transición con auditoría**.

## Resultado final
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (586 tests, 68 suites).
  - `npm run test:e2e -- --forceExit` → 44 suites / 280 tests OK (incluye `promesas-auditables.e2e-spec.ts`, 6 tests).
- Archivos modificados:
  - `src/modules/cartera/auditoria-cartera.entity.ts` — union `AUDITORIA_CARTERA_ENTIDAD` + `"promesa"`.
  - `src/modules/cartera/promesas-pago.service.ts` (+spec) — `listarPorPrestamo`, `transicionarEstado`.
  - `src/modules/cartera/dto/transicionar-estado-promesa.dto.ts` (nuevo).
  - `src/modules/cartera/cartera.controller.ts` (+spec) — `GET .../prestamos/:prestamoId/promesas` y `PATCH .../promesas/:promesaId/estado`.
  - `src/modules/cartera/cartera.module.ts` — registro de `PromesasPagoService`.
  - `test/e2e/promesas-auditables.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/promesas-auditables.md` (este archivo).
- Decisiones de implementación:
  - `listarPorPrestamo` devuelve todas las promesas/acuerdos (IA + cobrador + agente) con origen (conversación/visita), ordenadas por `created_at DESC`.
  - `transicionarEstado` valida motivo obligatorio, rechaza transicionar al mismo estado, y registra en `auditoria_cartera` (`entidad: promesa`, `operacion: editar`, valoresAntes/Despues del estado, actor, motivo) en la misma transacción.
  - Permisos: GET `ver_reportes`, PATCH `generar_reporte`.
- Revisión independiente (code-reviewer, 2026-08-21): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) test unitario de motivo de solo espacios (BadRequest); (b) test e2e de estado inválido → 400. Registrado en backlog: refactor para extraer un helper compartido de construcción de fila de auditoría (nit). Documentadas sin cambio: `RequesterPromesaContext` duplica `RequesterOwned` (nit), permiso `generar_reporte` para la transición (decisión consciente del plan), mutación de entidad fuera de la transacción (nit), limpieza inline del socio temporal en e2e (patrón consistente).
- Fix externo de aislamiento: el spec pre-existente `mapa-clientes-dia.e2e-spec.ts` fallaba por residuo del socio `socio-mapa-2` (no limpiaba `SC-MAPA-2` en beforeAll/afterAll); se agregó la limpieza. También se añadió `SC-PROMAUD-2` al afterAll del e2e de esta feature por robustez.
- Pendientes/seguimiento:
  - Impacto de las promesas en reportes diarios y liquidaciones (diferido a HU-18/50/HU-20).
  - Automatización de la transición de estado (marcar cumplida al registrarse el pago).