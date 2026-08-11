# Tarea: Login del administrador (HU-01)

- **Origen:** HU-01 (docs/APP_REQUIREMENTS.md:30) — prerequisito lógico de HU-02
- **Estado:** completada
- **Fecha inicio:** 2026-08-11

## Objetivo
Que un Administrador pueda iniciar sesión con usuario y contraseña (`POST /auth/login`) sobre un canal cifrado, obtener tokens de sesión cortos con refresh rotado, y que un guard JWT proteja las rutas autenticadas del backend, sentando la base de persistencia TypeORM+PostgreSQL para el resto del MVP.

## Fuera de alcance
- Registro/edición/bloqueo de socios y cobradores (HU-02 a HU-05).
- RBAC y matriz de permisos (HU-06, HU-07).
- Panel admin frontend (Next.js no existe aún).
- Blacklist/revocación de refresh tokens en DB (stateless por ahora → backlog).
- Rate limiting del endpoint de login (→ backlog).
- Reset/cambio de contraseña (HU-04).
- Terminación TLS real en local (la valida el entorno; el proxy termina TLS en producción).

## Bloques (checklist TDD)
- [x] Bloque 1: Infraestructura de persistencia — docker-compose local con postgis/postgis:16-3.4, conexión TypeORM desde `DATABASE_URL`, deps instaladas (`@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/config`). Verificación: `docker compose up -d` levanta Postgres, `scripts/check.sh` en verde, la app arranca sin error.
- [x] Bloque 2: Entidad `AdminUser` + repositorio + seed del primer admin desde `.env` (`ADMIN_INITIAL_USERNAME`/`ADMIN_INITIAL_PASSWORD`), contraseña hasheada con bcrypt. Tests con repositorio mockeado.
- [x] Bloque 3: Servicio de auth — valida credenciales (bcrypt.compare), emite access token corto y refresh token con secrets propios; rotación de refresh. Tests unitarios de reglas (credenciales inválidas, usuario bloqueado, rotación).
- [x] Bloque 4: HTTP — `POST /auth/login`, `POST /auth/refresh`, guard JWT aplicado a `GET /auth/me` (demostración de ruta protegida). Tests de integración con supertest.
- [x] Bloque 5: TLS enforced por entorno — en `NODE_ENV=production` la app exige terminación TLS (header `X-Forwarded-Proto=https`) o no arranca; en local corre HTTP. Test unitario de la validación.
- [x] Extensión (verificación): fail-fast de arranque si faltan `DATABASE_URL`/`JWT_SECRET`/`JWT_REFRESH_SECRET` (se detectó que con secrets vacíos login daba 500). `JWT_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` tienen default (`15m`/`7d`).

## Decisiones tomadas durante la implementación
- Persistencia: **TypeORM + PostgreSQL** (decisión del usuario).
- Primer admin: **seed desde .env** (decisión del usuario).
- Sesión: **access + refresh tokens completos** (decisión del usuario).
- TLS: **enforced por entorno** (decisión del usuario).
- Hasheo de contraseña: **bcrypt** (PRD 3.2 permite bcrypt/argon2; se elige bcrypt por simplicidad).
- Guard JWT: **custom guard sobre `@nestjs/jwt`** (sin Passport) — menos abstracciones, directo de testear, suficiente para RBAC futuro.
- Refresh token **stateless** (JWT firmado con `JWT_REFRESH_SECRET`, sin tabla de blacklist en esta iteración).
- **Single-tenant en esta iteración**: la entidad `admin_users` omite `tenant_id` que el PRD 4.2 lista. El MVP local opera con un solo administrador/tenant; el multi-tenancy se incorporará cuando exista la tabla `tenants` (registrado por el code-reviewer).
- **Mitigación de timing side-channel**: se agregó un `bcrypt.compare` contra un hash fijo cuando el usuario no existe, para no enumerar usuarios por tiempo de respuesta (observación del code-reviewer).
- **Deployment note (X-Forwarded-Proto)**: el `HttpsGuard` confía en `X-Forwarded-Proto` en producción; la app nunca debe exponerse directamente a internet sin proxy — el proxy debe terminar TLS y descartar ese header del cliente.
- Tooling local: se instaló el plugin `docker-compose` vía brew (5.4.0) — el sistema no lo tenía y el plan requería Compose.
- Versiones: `@nestjs/typeorm@11`, `@nestjs/jwt@11`, `typeorm@1.1.0` (Nest 1.x actual), compatibles con `@nestjs/common@10` (peers lo confirman). Documentación consultada: https://github.com/nestjs/typeorm (context7).
- Obs: `nest build` emite en `dist/src/` porque `tsconfig.json` incluye `test/**` sin `rootDir`; el arranque se verifica con `node dist/src/main.js`. Quirk preexistente del skeleton, no tocado en esta tarea (no bloquea).

## Ambigüedades resueltas con el usuario
- Pregunta: capa de persistencia → Respuesta: TypeORM + PostgreSQL (Recomendado).
- Pregunta: bootstrap del primer admin → Respuesta: Seed desde .env (Recomendado).
- Pregunta: alcance del flujo de sesión → Respuesta: Access + refresh tokens completos.
- Pregunta: HTTPS/TLS → Respuesta: Enforced por entorno (Recomendado).
- Pregunta: cómo levantar Postgres local → Respuesta: Instalar docker compose (Recomendado).

## Resultado final (llenar al completar)
- **Parcial (Bloque 1, 2026-08-11):** docker-compose.yml creado y Postgres healthy en 5432; deps instaladas; `AppModule` con `ConfigModule` + `TypeOrmModule.forRootAsync`; `.env.example` ampliado (JWT_REFRESH_*, ADMIN_INITIAL_*); `scripts/check.sh` verde; app arranca y conecta (health OK).
- **Parcial (Bloque 2, 2026-08-11):** entidad `AdminUser` (tabla `admin_users` creada vía synchronize), `AdminUserSeedService` (OnApplicationBootstrap) con 3 tests (skip si hay admin, crea con hash si hay credenciales, skip sin lanzar si faltan vars); modulo `AdminUsersModule` registrado; app arranca y advierte si faltan `ADMIN_INITIAL_*`. Decisión: campos de perfil (nombre/apellido/correo/telefono) nullable — el seed solo crea credenciales.
- **Parcial (Bloque 3, 2026-08-11):** `AuthService` con login (bcrypt.compare, mismo error para usuario inexistente/contraseña mala/admin bloqueado) y refresh rotado (stateless, jti nuevo). 7 tests unitarios. `AuthModule` registrado en AppModule.
- **Parcial (Bloque 4, 2026-08-11):** DTOs (`LoginDto`, `RefreshDto`) con class-validator, `JwtAuthGuard` (Bearer, verifica con JWT_SECRET, exige tipo access), `AuthController` (`POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`). `ValidationPipe` global en main.ts. 8 tests unitarios (guard + controller) + e2e `test/e2e/auth.e2e-spec.ts` con DB real (7 tests).
- **Parcial (Bloque 5, 2026-08-11):** `HttpsGuard` registrado global (APP_GUARD) — exige HTTPS solo en producción (secure directo o `X-Forwarded-Proto=https`); `trust proxy` en main.ts. 5 tests unitarios.
- **Extensión (2026-08-11):** `validateRequiredEnv` (fail-fast en arranque) + defaults de expiración. Detectado en smoke test: con `JWT_SECRET`/`JWT_EXPIRES_IN` vacíos el login daba 500.
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+28 tests unitarios), `npm run test:e2e` (7 tests), smoke test manual (login→me→refresh→401) con app real + DB.
- Archivos modificados: `docker-compose.yml`, `.env.example`, `package.json`, `src/app.module.ts`, `src/main.ts`, `src/config/config-validation.ts`, `src/modules/admin-users/*`, `src/modules/auth/*`, `src/modules/security/*`, `test/e2e/auth.e2e-spec.ts`, `docs/ai/tasks/login-administrador.md`.
- Pendientes/seguimiento: el usuario debe setear `JWT_SECRET` y `JWT_REFRESH_SECRET` en `.env` (y opcionalmente `ADMIN_INITIAL_USERNAME`/`ADMIN_INITIAL_PASSWORD` para el seed) o la app no arranca / no hay primer admin. No se commiteó nada (sin instrucción). Backlog sugerido: blacklist/revocación de refresh tokens, rate limiting de `/auth/login`.
- **Revisión independiente (code-reviewer, 2026-08-11):** veredicto APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: (1) dummy `bcrypt.compare` para igualar timing con usuario inexistente; (2) test "access usado como refresh" ahora firma con `test-refresh-secret` y ejercita la rama de tipo; (3) tests de refresh con admin inexistente y bloqueado; (4) fail-fast movido ANTES de `NestFactory.create` (con `import "dotenv/config"`) para que `DATABASE_URL` faltante falle de forma legible; (5) aserción e2e de que `passwordHash` no se filtra en la respuesta de login. Observaciones documentadas sin cambio: `tenant_id` omitido (single-tenant MVP), nota de despliegue sobre `X-Forwarded-Proto`, tradeoff de rotación stateless ya en backlog. Nota tooling: se corrigió el model ID de `.opencode/agent/code-reviewer.md` (`opencode/claude-haiku-4-5` → `claude-haiku-4-5`); requiere reiniciar opencode para que el subagente use el modelo correcto.
