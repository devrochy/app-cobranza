# Changelog

Formato basado en [Conventional Commits](https://www.conventionalcommits.org/) y agrupado por versión siguiendo [SemVer](https://semver.org/lang/es/). Ver skill `github-gitflow-cicd` para el proceso de release.

## [Unreleased]

## [0.3.0] - 2026-08-12

### Added

- **HU-08 — Registro de rutas**: `POST /rutas` (gated por `registrar_ruta`) con validaciones (404 socio/cobrador inexistentes, 409 si bloqueados, interés > 0, moneda ISO) y ownership; **cascada de bloqueo de rutas** al bloquear/activar un cobrador (diferida de HU-05); `PATCH /rutas/:id/estatus` (reactivación manual) y `PATCH /rutas/:id/cobrador` (reasignación).
- **HU-09 — Editar nombre/descripción de ruta**: `PATCH /rutas/:id` (gated por `configurar_ruta`) que solo toca metadata, dejando intacta la configuración operativa.
- **9a — Editar configuración de ruta**: `PATCH /rutas/:id/configuracion` para `tipoInteres`/`numCuotas`; la `moneda` NO es editable (decisión, evita mezclar monedas en estadísticas).
- **HU-10 — Matriz `ruta_config`**: `GET`/`PUT /rutas/:id/ruta-config` con los 25 parámetros de la APK del cobrador (visibilidad, cupo, comisión, permisos de borrado, etc.), defaults conservadores y PUT de reemplazo total.
- **HU-11 — Inyecciones de capital**: `POST /rutas/:id/inyecciones` (valor > 0 + comentario obligatorio), estado `activa` y timestamp.
- **HU-12 — Eliminar inyección con trazabilidad**: `DELETE /rutas/:id/inyecciones/:inyeccionId` como **soft-delete** (`estado = eliminada`) conservando el registro y su `fecha_hora` (snapshot inmutable, PRD 4.3).
- **HU-13 — Color de riesgo por cliente**: regla pura `calcularColorRiesgo` (`src/domain/`, azul/rojo/blanco, umbral inclusivo desde `ruta_config`); el wiring con `clientes`/`cuotas` se difiere a HU-14/15.

### Tests

- Suite unitaria (186 tests) y e2e (126 tests sobre Postgres real) cubriendo la Épica 2. Se fijó ejecución serial de e2e (`testTimeout`/`maxWorkers: 1`) por flakiness de pools paralelos.

### Docs

- Archivo de tarea por HU en `docs/ai/tasks/` (HU-08 a HU-13, 9a) y backlog ampliado (desviación `prestamos.tipo_interes`, moneda no editable, `assertOwned`/`numericTransformer` duplicados, transaccionalidad de la cascada).

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
