# Tarea: Registrar cobrador (HU-03)

- **Origen:** HU-03 (docs/APP_REQUIREMENTS.md:32)
- **Estado:** completada
- **Fecha inicio:** 2026-08-11

## Objetivo
Que un Administrador autenticado registre un Cobrador (`POST /cobradores`) asociado obligatoriamente a un Socio existente, para mantener la jerarquía Socio → Cobrador → Ruta, sin exponer la contraseña.

## Fuera de alcance
- Edición (HU-04), bloqueo en cascada de rutas (HU-05), matriz de permisos (HU-06), login de socio/cobrador (HU-07).
- Dispositivos/IMEI/WhatsApp (HU-39+).
- Multi-tenancy real (`tenant_id`) — se continúa la decisión single-tenant de HU-01/HU-02.

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad `Cobrador` (tabla `cobradores` sin `moneda`, FK `socio_id` → `socios.id` con `onDelete: RESTRICT`, unicidad global en usuario/codigo/correo/telefono) + `CobradoresModule` registrado en AppModule. Verificación: build + tabla creada con FK.
- [x] Bloque 2: `CobradoresService.create()` — socio inexistente 404, socio bloqueado 409, unicidad por campo 409, hasheo con `PasswordService`, TOCTOU 23505 → 409, respuesta sin `passwordHash`. Tests unitarios.
- [x] Bloque 3: `CreateCobradorDto` (socio_id entero positivo, password ≥8, correo `@IsEmail`, telefono `@IsPhoneNumber`, estatus opcional default activo) + `CobradoresController` (`POST /cobradores` con `JwtAuthGuard`). Tests unitarios del controller.
- [x] Bloque 4: e2e `test/e2e/cobradores.e2e-spec.ts` (201, 404 socio inexistente, 409 duplicado, 409 socio bloqueado, 400 validación, 401 sin token).

## Decisiones tomadas durante la implementación
- `codigo` del cobrador único global (decisión del usuario).
- Rechazar el registro si el socio asociado está bloqueado → 409 (decisión del usuario).
- Correo y teléfono obligatorios (decisión del usuario).
- Contraseña mínima 8 caracteres, `estatus` default `activo` (consistente con HU-02).
- Validación de socio con `Repository<Socio>` directo en `CobradoresModule` (`TypeOrmModule.forFeature([Cobrador, Socio])`), sin importar `SociosModule`.
- Socio inexistente → `NotFoundException` (404); duplicados y socio bloqueado → `ConflictException` (409).
- Se repite la lógica de unicidad/hash del módulo socios (2º uso); si HU-08 (rutas) la requiere de nuevo, extraer helper compartido.

## Ambigüedades resueltas con el usuario
- Pregunta: alcance del codigo único → Respuesta: único global.
- Pregunta: socio bloqueado → Respuesta: rechazar el registro (409).
- Pregunta: correo/teléfono → Respuesta: obligatorios.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+48 tests unitarios), `npm run test:e2e` (19 tests: health, auth, socios, cobradores).
- Archivos modificados: `src/app.module.ts`, `src/modules/cobradores/*` (entity, module, service, controller, dto), `test/e2e/cobradores.e2e-spec.ts`, `docs/ai/tasks/registrar-cobrador.md`.
- Pendientes/seguimiento: se detectó colisión de datos únicos entre specs e2e paralelas que comparten DB (socios vs cobradores) — resuelto con valores únicos por spec; conviene documentar/estandarizar los datos de prueba e2e para futuras HU. `JwtAuthGuard` sigue sin distinguir rol admin/socio (pendiente HU-07).
