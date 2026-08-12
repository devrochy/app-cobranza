# Changelog

Formato basado en [Conventional Commits](https://www.conventionalcommits.org/) y agrupado por versión siguiendo [SemVer](https://semver.org/lang/es/). Ver skill `github-gitflow-cicd` para el proceso de release.

## [Unreleased]

## [0.2.0] - 2026-08-12

### Added

- **HU-01 — Login de administrador**: `POST /auth/login` con bcrypt, JWT de corta duración + refresh rotado, `JwtAuthGuard`, `HttpsGuard` (TLS por entorno) y seed del primer admin desde `.env`. Infraestructura local: docker-compose con postgis, conexión TypeORM y fail-fast de variables de entorno.
- **HU-02 — Registro de socios**: `POST /socios` con validación (contraseña ≥ 8, correo/teléfono/moneda ISO 4217), unicidad global (usuario/codigo/correo/teléfono) y respuesta sin `passwordHash`.
- **HU-03 — Registro de cobradores**: `POST /cobradores` asociado obligatoriamente a un socio existente (404 si no existe, 409 si el socio está bloqueado), unicidad global y FK con `ON DELETE RESTRICT`.
- **HU-04 — Edición de socio/cobrador**: `PATCH /socios/:id` y `PATCH /cobradores/:id` (perfil + contraseña re-hasheada) sin exponer nunca la contraseña anterior.
- **HU-05 — Bloqueo/activación**: `PATCH /socios/:id/estatus` y `PATCH /cobradores/:id/estatus`, idempotentes, con punto de integración de cascada de rutas (se cablea en HU-08).
- **HU-06 — Matriz de permisos por socio**: `GET`/`PUT /socios/:id/permisos` con el catálogo de 20 permisos del PRD, reemplazo total transaccional y ausencia de fila = deshabilitado.
- **HU-07 — Acceso del socio por permisos**: `POST /auth/socio/login`, rol `admin|socio` en el JWT, refresh rol-aware, `PermisoGuard`/`@PermisoRequerido` (admin bypass, socio necesita el permiso, 403 si no) y ownership cross-socio (un socio solo opera sobre sus propios recursos).
- **Extensión aprobada — Matriz de permisos de cobrador** (`cobrador_permisos`, catálogo de 12): gestionada por el socio con `editar_permisos` sobre sus colaboradores (`GET /cobradores` filtrado + `GET`/`PUT /cobradores/:id/permisos` con ownership). Desviación explícita del PRD 4.2 registrada en `docs/ai/tasks/acceso-socio-permisos.md`.
- **CI/CD**: pipeline con lint, typecheck, tests unitarios con cobertura, job e2e sobre Postgres real y escaneo de secretos (gitleaks). Reglas de commit + PR por HU (GitFlow) en `AGENTS.md`.

### Tests

- Suite unitaria (121 tests) y e2e (69 tests sobre Postgres real) cubriendo los flujos de las 7 historias.

### Docs

- Roadmap de historias (`docs/plan-feature-roadmap.md`) y archivo de tarea por HU en `docs/ai/tasks/`.
