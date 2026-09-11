---
estado: en progreso
tags: [tarea]
---

# Tarea: Seguridad de auth — rate limiting de login + revocación de refresh tokens

- **Origen:** Petición directa del usuario (2026-09-11) — pendiente #2 del backlog (`docs/ai/tasks/backlog.md`: "Rate limiting del endpoint /auth/login" y "Blacklist/revocación de refresh tokens").
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-11

## Objetivo
1. Limitar los intentos de login (`/auth/login`, `/auth/socio/login`, `/auth/cobrador/login`) por IP (anti fuerza bruta), devolviendo 429 al exceder el límite.
2. Poder revocar un refresh token (logout real): tabla de blacklist, verificación en `refresh` y endpoint `POST /auth/logout`.

## Fuera de alcance
- Rotación automática de refresh token en cada `refresh`.
- Throttling de otros endpoints.
- Bloqueo de cuenta por intentos fallidos (solo throttling por IP).

## Bloques (checklist TDD)
- [x] Bloque 1: módulo de throttling configurado por env + guard aplicado a los 3 login (429 al exceder).
  - Test(s): `test/e2e/seguridad-auth.e2e-spec.ts` (login repetido → 429)
- [x] Bloque 2: entidad `RefreshTokenRevocado` + verificación en `AuthService.refresh` (401 si está revocado).
  - Test(s): `src/modules/auth/auth.service.spec.ts` + `test/e2e/seguridad-auth-logout.e2e-spec.ts`
- [x] Bloque 3: endpoint `POST /auth/logout` (revoca, idempotente).
  - Test(s): `src/modules/auth/auth.controller.spec.ts` + `test/e2e/seguridad-auth-logout.e2e-spec.ts`

## Decisiones tomadas durante la implementación
- Límite 5 intentos / 60s por IP (configurable por `AUTH_THROTTLE_LIMIT` / `AUTH_THROTTLE_TTL_MS`).
- Contador único por IP para los 3 endpoints de login (`generateKey` custom), no por ruta.
- Store de throttling en memoria (instancia única, MVP local).
- Blacklist solo de `jti` revocados (no se persisten todos los emitidos). Sin rotación automática.
- La blacklist no se purga automáticamente; `expiraEn` queda disponible para un job de limpieza futuro (aceptado en MVP).
- e2e: límite alto en `test/e2e/setup.ts` para no romper las suites existentes.

## Ambigüedades resueltas con el usuario
- Pregunta: alcance → Respuesta: Backend + Panel (cablear logout real).
- Pregunta: límite por IP → Respuesta: 5 intentos/min.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (106 suites, 935 tests) + `npm run test:e2e` (56 suites, 399 tests) → verde.
- Archivos modificados:
  - `src/modules/auth/auth.module.ts` — `ThrottlerModule.forRootAsync` (login, por env).
  - `src/modules/auth/auth.controller.ts` — `ThrottlerGuard` en los 3 login + `POST /auth/logout` (204).
  - `src/modules/auth/auth.service.ts` — check de blacklist en `refresh` + método `revocar`.
  - `src/modules/auth/refresh-token-revocado.entity.ts` — entidad de blacklist.
  - `src/modules/auth/auth.service.spec.ts`, `auth.controller.spec.ts` — tests nuevos.
  - `test/e2e/seguridad-auth.e2e-spec.ts` (throttle), `test/e2e/seguridad-auth-logout.e2e-spec.ts` (revocación).
  - `test/e2e/setup.ts` — límite alto para las suites existentes.
  - `src/modules/cartera/prestamo.service.spec.ts` — fix del time-bomb de fecha (mismo fix que PR #115, pendiente de merge).
  - `.env.example` — documenta `AUTH_THROTTLE_LIMIT`/`AUTH_THROTTLE_TTL_MS`.
  - `src/config/db-options.ts` — exporta `toPositiveInt` (reutilizado por el throttle).
- Pendientes/seguimiento: rotación automática (fuera de alcance); job de purga de la blacklist; **migración/DDL de `refresh_token_revocados` para producción** (el proyecto usa `synchronize` solo en dev); mensaje específico de 429 en el login del panel; el fix de `prestamo.service.spec.ts` se solapa con el PR #115 (resolver al mergear).
