---
estado: en progreso
tags: [tarea]
---

# Tarea: P0.3 — Seguridad de sesión (rotación y purga de refresh tokens)

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P0 Robustez+seguridad**; ítems diferidos de `seguridad-auth`: rotación de refresh tokens, purga de la blacklist y migración/DDL de `refresh_token_revocados` para producción.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-12

## Objetivo
Que cada refresh token sea de un solo uso (se revoca el `jti` al refrescar), que la blacklist no crezca indefinidamente (job de purga) y que la tabla exista en producción (DDL).

## Fuera de alcance
- Detección atómica de reuso concurrente (la verificación previa `findOne` + `upsert` no es transaccional; se documenta).
- Panel/APK: no requieren cambios (ya persisten el nuevo refresh token, `api.ts:102`).

## Bloques (checklist TDD)
- [x] Bloque 1: `AuthService.refresh` revoca el `jti` usado al rotar (refresh token de un solo uso).
  - Test(s): `src/modules/auth/auth.service.spec.ts`
- [x] Bloque 2: job diario que purga de `refresh_token_revocados` los tokens ya expirados.
  - Test(s): `src/modules/auth/refresh-token-purge.service.spec.ts`
- [x] Bloque 3: DDL de `refresh_token_revocados` para producción (`synchronize:false`) documentado.
  - Archivo: `docs/ddl/refresh_token_revocados.sql`

## Decisiones tomadas durante la implementación
- `refresh` delega en `rotarYemitir(payload, rol, sub)`: revoca el `jti` usado (upsert idempotente) y emite el par nuevo. El reuso se detecta con la verificación previa de la blacklist (`findOne`).
- Purga con `@Cron(EVERY_DAY_AT_3AM)`: elimina `refresh_token_revocados` con `expira_en < ahora` (los `expira_en` siempre se setean al revocar, ya que el JWT de refresh lleva `exp`).
- No hay infraestructura de migraciones: se documenta el DDL en `docs/ddl/` para aplicación manual en producción.

## Ambigüedades resueltas con el usuario
- (ninguna)

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (108 suites, 971 tests) + `npm run test:e2e` (58 suites, 411 tests) → verde.
- Archivos modificados:
  - `src/modules/auth/auth.service.ts` (+ `.spec.ts`) — `refresh` revoca el `jti` usado (`rotarYemitir`, single-use).
  - `src/modules/auth/refresh-token-purge.service.ts` (+ `.spec.ts`) — job diario de purga de la blacklist.
  - `src/modules/auth/auth.module.ts` — registra el job.
  - `docs/ddl/refresh_token_revocados.sql` — DDL para producción.
- Pendientes/seguimiento: la detección de reuso concurrente no es atómica (pre-check `findOne` + `upsert`); si se requiere, pasar a un INSERT condicional con `affected` en un ítem futuro.
