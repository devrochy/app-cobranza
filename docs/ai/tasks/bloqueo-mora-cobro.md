# Tarea: Bloqueo automático por mora de cobro y auto-habilitación al pagar (HU-61)

- **Origen:** Roadmap Fase 5 ítem 36 (docs/plan-feature-roadmap.md:68) — HU-61 (docs/APP_REQUIREMENTS.md:38). Dependencias: `socios.dias_tolerancia_cobro` (HU-62, :39/:255), `cobros_socio` (HU-60, :125/:346-347), cascada HU-05 (:34), revalidación JWT por request.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-26

## Objetivo
Que el sistema bloquee automáticamente a un Socio cuando tenga cualquier cobro sin pagar con retraso superior a `dias_tolerancia_cobro` tras su `fecha_vencimiento` (job diario), y lo re-active automáticamente al registrarse el pago si ya no queda otro cobro moroso.

## Fuera de alcance
- Notificaciones al socio de bloqueo/habilitación (no exigidas por HU-61).
- Mejora de "no reactivar cobradores bloqueados manualmente" (backlog conocido).
- Tracking de `motivo_bloqueo` (política elegida no lo requiere).
- Auditoría formal (solo logs del job).
- Login de cobradores.

## Bloques (checklist TDD)
- [x] Bloque 1: Default de `socios.dias_tolerancia_cobro` de 0 → 5 (entidad) y corrección del e2e existente de socios que aserta 0.
  - Test(s): `test/e2e/socios.e2e-spec.ts` (diasToleranciaCobro toBe(5)), `src/modules/socios/socios.service.spec.ts` (fixtures).
- [x] Bloque 2: `SocioMoraService`: `bloquearMorosos(hoy)` (cualquier cobro no pagado con `fecha_vencimiento + dias_tolerancia_cobro < hoy` → `SociosService.setEstatus(id, "bloqueado")` solo si está activo) y `habilitarSiSinMorosidad(socioId, hoy)` (si bloqueado y sin cobros morosos restantes → `setEstatus(id, "activo")`).
  - Test(s): `src/modules/cobros-socio/socio-mora.service.spec.ts`.
- [x] Bloque 3: Wiring: `CobrosSocioJob` agrega `bloquearMorosos`; `CobrosSocioService.registrarPago` llama `habilitarSiSinMorosidad` tras marcar pagado.
  - Test(s): `src/modules/cobros-socio/cobros-socio-job.service.spec.ts`, `src/modules/cobros-socio/cobros-socio.service.spec.ts`.
- [x] Bloque 4: e2e `mora-socio.e2e-spec.ts`: bloqueo por mora con cascada (socio/cobrador/rutas), re-habilitación al pagar si no queda morosidad, permanece bloqueado si queda otro cobro moroso.
  - Test(s): `test/e2e/mora-socio.e2e-spec.ts`.
- Verificación: `scripts/check.sh` + `scripts/test-e2e.sh` (BD arriba).

## Decisiones tomadas durante la implementación
- `SocioMoraService` vive en el módulo `cobros-socio` (inyecta `SociosService`, exportado por `SociosModule`); el bloqueo/re-activación reusa `SociosService.setEstatus` (cascada HU-05 transaccional).
- `bloquearMorosos` consulta cobros con `estado != pagado` + relación socio, filtra en memoria por `fechaVencimiento + dias_tolerancia < hoy`, agrupa por socio y solo bloquea socios `activo` (los ya bloqueados se omiten). Guarda defensiva `estado === "pagado"` por si la query devuelve pagados.
- `habilitarSiSinMorosidad` se invoca desde `registrarPago` (lógica en servicio, no en controller, para que ningún caller la saltee). Usa `sociosService.obtener` para leer estatus + tolerancia.
- `CobrosSocioJob.handleCron` añade el paso `bloquearMorosos` (después de generar/marcar vencidos, antes de notificaciones).
- La condición de mora es estricta: `fechaVencimiento + dias_tolerancia < hoy` (retraso supera la tolerancia).

## Ambigüedades resueltas con el usuario
- Pregunta: condición de bloqueo → **cualquier cobro no pagado (pendiente o vencido) con `fecha_vencimiento + dias_tolerancia_cobro < hoy`**.
- Pregunta: auto-habilitación → **solo si no queda otro cobro moroso sin pagar** (acepta que un pago total deshaga un bloqueo manual).
- Pregunta: default de `dias_tolerancia_cobro` → **5 días** (antes 0).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar:
  - `scripts/check.sh` (lint + typecheck + tests unitarios) → OK (656 tests, 75 suites).
  - `scripts/test-e2e.sh` → OK (301 tests, 46 suites; incluye `mora-socio.e2e-spec.ts` 3 tests).
- Archivos modificados:
  - `src/modules/socios/socio.entity.ts` — default `dias_tolerancia_cobro` 0 → 5.
  - `src/modules/cobros-socio/socio-mora.service.ts` (+spec) — `bloquearMorosos` / `habilitarSiSinMorosidad`.
  - `src/modules/cobros-socio/cobros-socio-job.service.ts` (+spec) — paso `bloquearMorosos`.
  - `src/modules/cobros-socio/cobros-socio.service.ts` (+spec) — `registrarPago` → `habilitarSiSinMorosidad`.
  - `src/modules/cobros-socio/cobros-socio.module.ts` — provider `SocioMoraService`.
  - `test/e2e/socios.e2e-spec.ts` — aserción `diasToleranciaCobro` 0 → 5.
  - `test/e2e/mora-socio.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/bloqueo-mora-cobro.md` (este archivo).
- Revisión independiente (code-reviewer): realizada, APROBADO sin bloqueantes. Quick-wins aplicados: fixtures de `socios.service.spec.ts` alineados a `diasToleranciaCobro: 5`; paridad defensiva `?? 0` en `habilitarSiSinMorosidad`.
- Pendientes/seguimiento:
  - Re-activar el subárbol re-activa cobradores bloqueados manualmente (limitación conocida, backlog).
  - Trade-off aceptado: un pago que deja toda la deuda al día deshace un bloqueo manual.
  - Notificaciones de bloqueo/habilitación no cubiertas (HU-63 en adelante).
  - El e2e verifica el bloqueo a nivel de datos; un smoke test de acceso (socio bloqueado → 403 por revalidación JWT) queda como mejora opcional (la revalidación es preexistente y fuera de alcance).