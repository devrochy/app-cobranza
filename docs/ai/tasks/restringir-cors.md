# Tarea: restringir-cors (whitelist de orígenes para CORS)

- **Origen:** Seguridad del panel admin / APK — el backend habilitaba CORS abierto (`app.enableCors()` sin opciones). Aprobado por el usuario 2026-09-01.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-01

## Objetivo
Restringir CORS a una whitelist configurable vía `CORS_ORIGINS` (comma-separated). Sin whitelist: `false` en producción (sin cross-origin) y `true` en desarrollo (conveniente para el APK web local).

## Fuera de alcance
- Cambios en el pipeline de CI/CD.
- Otros middlewares de seguridad (helmet, rate-limit, etc.).

## Bloques (checklist TDD)
- [x] Bloque 1: `src/config/cors.ts` — `resolverOrigenesCors(CORS_ORIGINS, NODE_ENV)`: whitelist si `CORS_ORIGINS`; `false` en producción sin whitelist; `true` en dev.
  - Test(s): `src/config/cors.spec.ts` (4)
- [x] Bloque 2: `src/main.ts` — `app.enableCors({ origin: resolverOrigenesCors(...) })`.
  - Test(s): typecheck
- [x] Bloque 3: `.env.example` — documentar `CORS_ORIGINS`.
- [ ] Bloque 4: `scripts/check.sh` verde + commit/PR.

## Decisiones tomadas durante la implementación
- `CORS_ORIGINS` vacío/ausente → dev permite todos (`true`), producción bloquea cross-origin (`false`).
- La whitelist se parsea con trim y se ignoran entradas vacías.

## Ambigüedades resueltas con el usuario
- Comportamiento por defecto en dev vs. producción (dev abierto, prod cerrado sin whitelist).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: ...
- Archivos modificados: ...
- Pendientes/seguimiento: ...