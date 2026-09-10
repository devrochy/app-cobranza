---
estado: completada
tags: [tarea]
---

# Tarea: perfil-autoupdate — auto-actualización del perfil (nombre/apellido)

- **Origen:** Petición del usuario (editar perfil en la APK; cobrador y socio). HU-25-adyacente.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-10

## Objetivo
Endpoint `PATCH /perfil` autenticado que permite a un **cobrador o socio** actualizar su
propio `nombre` y `apellido`. Devuelve `{ id, usuario, nombre, apellido }`.

## Fuera de alcance
- Cambio de teléfono, correo o contraseña (solo nombre/apellido).
- Edición de perfil por parte de un admin sobre otro usuario (eso ya existe en `/socios`/`/cobradores`).

## Contrato
- `PATCH /perfil` (JwtAuthGuard). Body `{ nombre: string, apellido: string }` (obligatorios).
- Ramifica por `req.user.rol`/`sub`: actualiza `cobradores` o `socios`.
- 403 si el rol no es cobrador/socio; 404 si el usuario no existe.

## Decisiones
- Módulo nuevo `perfil` (controller `@Controller("perfil")`, ruta `PATCH /perfil`).
- `JwtAuthGuard` revalida el estado activo; no se exige permiso (auto-edición).

## Bloques (checklist TDD)
- [x] Bloque 1: `PerfilService.actualizar` actualiza cobrador/socio por rol+sub; 404/403.
  - Test(s): `src/modules/perfil/perfil.service.spec.ts` (4 tests, verde)
- [x] Bloque 2: `PerfilController` delega con rol+sub del usuario autenticado.
  - Test(s): `src/modules/perfil/perfil.controller.spec.ts` (1 test, verde)
- [x] Bloque 3: verificación final (`scripts/check.sh`) + e2e.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 903 tests, verde) y `test/e2e/perfil.e2e-spec.ts` (5 tests, verde contra Postgres local).
- Archivos creados: `src/modules/perfil/{perfil.controller,perfil.service,perfil.module}.ts`, `src/modules/perfil/dto/actualizar-perfil.dto.ts`, specs (service/controller), `test/e2e/perfil.e2e-spec.ts`.
- Modificado: `src/app.module.ts` (registro de `PerfilModule`).
- Contrato: `PATCH /perfil` (JwtAuthGuard) `{ nombre, apellido }` → `{ id, usuario, nombre, apellido }`; 400 si falta campo, 401 sin token, 403 para rol admin.
- Pendientes/seguimiento: consumir `PATCH /perfil` desde la APK (tarea siguiente).
