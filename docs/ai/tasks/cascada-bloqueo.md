# Tarea: Cascada de bloqueo socio → cobradores → rutas con transacción (HU-05/HU-61)

- **Origen:** HU-05/HU-61 (docs/APP_REQUIREMENTS.md:34,44) + backlog "Cascada de bloqueo de rutas sin transacción"
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Que al bloquear (o reactivar) un Socio se aplique la cascada sobre sus Cobradores y las Rutas de estos, todo en una única transacción (rollback si algo falla), y que el bloqueo de un Cobrador sobre sus rutas también quede en transacción.

## Fuera de alcance
- El job de bloqueo automático por mora (HU-61) y el cobro de socios (HU-60) — se construyen en Fase 5.
- El login del cobrador (aún no existe); solo se prepara la cascada de estados.

## Bloques (checklist TDD)
- [x] Bloque 1: `SociosService.setEstatus` bloquea/activa al socio y en cascada a sus cobradores y sus rutas, dentro de una transacción (si la cascada falla, se revierte el bloqueo del socio).
  - Test(s) que lo prueban: `src/modules/socios/socios.service.spec.ts` (bloquea socio+cobradores+rutas, reactiva, rollback si falla la cascada, 404).
- [x] Bloque 2: `CobradoresService.setEstatus` envuelve el save del cobrador y la cascada de sus rutas en una transacción.
  - Test(s) que lo prueban: `src/modules/cobradores/cobradores.service.spec.ts` (bloquea+rutas, reactiva, rollback si falla la cascada, 404).

## Decisiones tomadas durante la implementación
- Se usa `dataSource.transaction` con el manager de TypeORM en ambos servicios (DataSource global vía `autoLoadEntities`).
- La cascada en ambos sentidos: bloquear bloquea todo el subárbol; reactivar lo reactiva (coherente con el comportamiento existente cobrador→rutas). Se documenta la salvedad de no reactivar cobradores bloqueados manualmente como mejora futura.
- `CobradoresService` deja de depender de `RutasService.aplicarCascada` y hace la actualización de rutas inline dentro de la transacción.

## Ambigüedades resueltas con el usuario
- Reactivar un socio también reactiva cobradores y rutas (según HU-05/HU-61: al recibir el pago se habilitan socio y cobradores).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 185 tests unitarios en verde).
- Archivos modificados: `src/modules/socios/socios.service.ts`, `src/modules/socios/socios.service.spec.ts`, `src/modules/cobradores/cobradores.service.ts`, `src/modules/cobradores/cobradores.service.spec.ts`, `docs/ai/tasks/cascada-bloqueo.md`.
- Pendientes/seguimiento: la mejora de no reactivar cobradores bloqueados manualmente al reactivar un socio queda como consideración futura; el job de bloqueo automático por mora (HU-61) y el cobro de socios (HU-60) se construyen en Fase 5 según el roadmap.
- **Revisión final (code-reviewer, 2026-08-17):** APROBADO CON OBSERVACIONES (sin bloqueantes). Observaciones registradas en backlog: `RutasService.aplicarCascada` quedó como código muerto, riesgo de reactivar cobradores bloqueados manualmente, y falta e2e de la cascada socio → cobradores → rutas. La reversión de la decisión previa ("bloquear socio NO cascada") quedó documentada en esta tarea y en backlog para trazabilidad.