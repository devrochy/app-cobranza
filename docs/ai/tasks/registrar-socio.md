# Tarea: Registrar socio (HU-02)

- **Origen:** HU-02 (docs/APP_REQUIREMENTS.md:31)
- **Estado:** completada
- **Fecha inicio:** 2026-08-11

## Objetivo
Que un Administrador autenticado pueda registrar un Socio (`POST /socios`) con usuario, contraseña, nombre, apellido, correo, teléfono, código, moneda y estatus, para habilitar la operación de una nueva cartera/negocio, sin exponer jamás la contraseña.

## Fuera de alcance
- Edición de socios (HU-04), bloqueo/activación (HU-05).
- Matriz de permisos `socio_permisos` (HU-06) y login del socio (HU-07).
- Multi-tenancy real (`tenant_id`) — se continúa la decisión single-tenant documentada en HU-01.
- Frontend del panel admin.

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad `Socio` (tabla `socios`, sin `tenant_id`) + `SociosModule` registrado en AppModule. Unicidad en `usuario`, `codigo`, `correo`, `telefono` (constraint). Verificación: build + arranque + tabla creada.
- [x] Bloque 2: `PasswordService` compartido (`hash`/`compare` con bcrypt) con tests; reemplazar usos duplicados en `admin-users.seed.service.ts` y `auth.service.ts`.
- [x] Bloque 3: `SociosService.create()` — chequeo de unicidad por campo (409), hasheo con `PasswordService`, persiste, devuelve el socio sin `passwordHash`. Tests unitarios.
- [x] Bloque 4: `CreateSocioDto` (contraseña ≥8, `@IsEmail`, `@IsPhoneNumber`, moneda regex `^[A-Z]{3}$`, estatus enum) + `SociosController` (`POST /socios` con `JwtAuthGuard`). Tests unitarios del controller.
- [x] Bloque 5: e2e `test/e2e/socios.e2e-spec.ts` (201 con token, 400 validación, 409 duplicado, 401 sin token).

## Decisiones tomadas durante la implementación
- Unicidad de `usuario`, `codigo`, `correo`, `telefono` (decisión del usuario).
- Moneda como código ISO 4217 (regex `^[A-Z]{3}$`) (decisión del usuario).
- Contraseña mínima 8 caracteres (decisión del usuario).
- Correo y teléfono obligatorios (decisión del usuario).
- `estatus` default `activo`; el DTO permite `activo|bloqueado` (bloqueo formal es HU-05).
- Se extrae `PasswordService` compartido para evitar tercera copia de bcrypt (aprobado en plan).
- Doble capa de unicidad: constraint en BD + chequeo en servicio con 409 (mensaje limpio sobre el error Postgres 23505).

## Ambigüedades resueltas con el usuario
- Pregunta: campos únicos → Respuesta: usuario, codigo, correo, telefono.
- Pregunta: representación de moneda → Respuesta: código ISO 4217.
- Pregunta: política de contraseña → Respuesta: mínimo 8 caracteres.
- Pregunta: correo/teléfono → Respuesta: obligatorios.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+40 tests unitarios), `npm run test:e2e` (13 tests: health, auth, socios), smoke test manual (POST /socios 201 sin passwordHash → duplicado 409 → sin token 401).
- Archivos modificados: `src/app.module.ts`, `src/modules/socios/*` (entity, module, service, controller, dto), `src/modules/security/password.service.ts` (+spec) y `security.module.ts`, `src/modules/auth/auth.service.ts` (+spec) y `auth.module.ts`, `src/modules/admin-users/admin-users.seed.service.ts` (+spec) y `admin-users.module.ts`, `test/e2e/socios.e2e-spec.ts`, `docs/ai/tasks/registrar-socio.md`.
- **Revisión independiente (code-reviewer, 2026-08-11):** APROBADO CON OBSERVACIONES. Correcciones aplicadas: (1) doble capa de unicidad real — `repo.save` envuelto en try/catch del error Postgres 23505 → 409 (TOCTOU); (2) `estatus` del DTO ahora opcional con default `activo` en el servicio (coherente con la doc y el default de columna); (3) e2e 400 ampliado (estatus inválido, campos vacíos, moneda minúscula) + test "sin estatus → 201 activo"; (4) spec del seed usa `PasswordService` en vez de `bcrypt` directo. Notas confirmadas: `libphonenumber-js` (dependencia de class-validator) presente — el e2e de teléfono pasa; `JwtAuthGuard` no distingue rol admin/socio (aceptable en MVP single-role, pendiente HU-07).
- Pendientes/seguimiento: nota de diseño — `JwtAuthGuard` hoy autentica cualquier usuario (solo existen admins); cuando llegue HU-07 (login de socios) habrá que distinguir rol admin vs socio en el guard. `@IsPhoneNumber(undefined)` acepta cualquier número internacional (decisión coherente con PRD 3.5 multi-país).
