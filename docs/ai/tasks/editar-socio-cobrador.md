# Tarea: Editar socio o cobrador (HU-04)

- **Origen:** HU-04 (docs/APP_REQUIREMENTS.md:33)
- **Estado:** completada
- **Fecha inicio:** 2026-08-11

## Objetivo
Que un Administrador autenticado edite los datos de perfil y la contraseña de un Socio o Cobrador (`PATCH /socios/:id`, `PATCH /cobradores/:id`) sin poder visualizar nunca la contraseña anterior (el hash no se devuelve en ninguna respuesta).

## Fuera de alcance
- Bloqueo/activación (HU-05), permisos (HU-06), login de socio/cobrador (HU-07).
- Editar `usuario`, `codigo`, `moneda`, `estatus` ni reasignar `socio_id` (decisión del usuario).
- Endpoints GET/listado de socios/cobradores.

## Bloques (checklist TDD)
- [x] Bloque 1: Edición de socios — `UpdateSocioDto` (todo opcional: nombre, apellido, correo, telefono, password) + `SociosService.update()` (404, body vacío 400, unicidad de correo/telefono excluyendo self 409, re-hash de password, TOCTOU 23505, respuesta sin passwordHash) + `PATCH /socios/:id` con `JwtAuthGuard`. Tests unitarios.
- [x] Bloque 2: Edición de cobradores — `UpdateCobradorDto` + `CobradoresService.update()` (misma lógica) + `PATCH /cobradores/:id`. Tests unitarios.
- [x] Bloque 3: e2e `test/e2e/edicion.e2e-spec.ts` (PATCH socio: 200 sin hash, 404, 409 unicidad, 400 vacío, 400 campo no editable, 401; PATCH cobrador: 200 y 404).

## Decisiones tomadas durante la implementación
- PATCH parcial con DTO todo-opcional (decisión aprobada).
- Campos editables: nombre, apellido, correo, telefono, password (decisión del usuario).
- Reasignación de `socio_id` fuera de alcance (decisión del usuario).
- "Al menos un campo" validado en el servicio → 400.
- Unicidad en update: `findOne` con OR de los campos provistos + comparación de `id`.
- `forbidNonWhitelisted` rechaza campos no editables (usuario/codigo/moneda/estatus/socio_id) → 400.

## Ambigüedades resueltas con el usuario
- Pregunta: campos editables → Respuesta: perfil + contraseña (nombre, apellido, correo, telefono, password).
- Pregunta: reasignar socio_id → Respuesta: fuera de alcance.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+68 tests unitarios), `npm run test:e2e` (29 tests: health, auth, socios, cobradores, edicion).
- Archivos modificados: `src/modules/socios/socios.service.ts` (+spec), `socios.controller.ts` (+spec), `dto/update-socio.dto.ts`; `src/modules/cobradores/cobradores.service.ts` (+spec), `cobradores.controller.ts` (+spec), `dto/update-cobrador.dto.ts`; `test/e2e/edicion.e2e-spec.ts`; `docs/ai/tasks/editar-socio-cobrador.md`; `docs/ai/tasks/backlog.md`.
- **Revisión independiente (code-reviewer, 2026-08-11):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: e2e verifica el hash persistido releído de BD (valida UPDATE de columna `select:false` en TypeORM 1.x), test unit de conflicto por correo ajeno en cobradores, ítem de backlog para unicidad case-insensitive de correo. Notas aceptadas sin cambio: mensaje genérico 409 en doble conflicto simultáneo; Red→Green queda implícito en los specs (los commits agrupan prod y test por tipo).
- **PR:** (a completar al abrirla)
